/**
 * Nightly automated end-user emails — runs after scoring + stage assignment.
 *
 * One email per user per night, chosen from their current row in `stages`.
 */
import React from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail, wasEmailSentRecently } from "@/lib/emails/send";
import { WelcomeEmail } from "@/emails/templates/Welcome";
import { FeatureNudgeEmail } from "@/emails/templates/FeatureNudge";
import { ValueDemoEmail } from "@/emails/templates/ValueDemo";
import { CheckInEmail } from "@/emails/templates/CheckIn";
import { UpgradeOfferEmail } from "@/emails/templates/UpgradeOffer";
import { UrgencyEmail } from "@/emails/templates/Urgency";
import { ChurnPreventionEmail } from "@/emails/templates/ChurnPrevention";
import type { EmailTrigger, LifecycleStage } from "@/types";

export type RunAutomatedEmailsResult = {
  sent: number;
  errors: string[];
};

type WorkspaceRow = {
  id: string;
  name: string;
  product_name: string | null;
  website_url: string | null;
  key_feature_name: string | null;
  reply_to_email: string | null;
};

type EventRow = {
  user_id: string | null;
  email: string | null;
  event_type: string;
  page: string | null;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

type StageRow = {
  user_id: string;
  stage: LifecycleStage;
};

/** Cooldown windows per trigger (hours). `null` = only send if never sent before. */
const COOLDOWN_HOURS: Record<EmailTrigger, number | null> = {
  welcome: null,
  feature_nudge: 5 * 24,
  value_demo: 7 * 24,
  check_in: 10 * 24,
  upgrade_offer: 7 * 24,
  urgency: 24,
  churn_prevention: 25 * 24,
  daily_summary: 24,
};

function isPageView(type: string): boolean {
  return /page[_-]?view/i.test(type);
}

function isFeatureUsed(type: string): boolean {
  return type === "feature_used" || type === "key_feature_used";
}

function isPricingVisit(ev: EventRow): boolean {
  if (ev.event_type === "pricing_page_visit") return true;
  return (
    isPageView(ev.event_type) &&
    (ev.page?.toLowerCase().includes("pricing") ?? false)
  );
}

function msAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function appUrlFor(ws: WorkspaceRow): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (ws.website_url) return ws.website_url.replace(/\/+$/, "");
  return configured || "https://app.conversioncrm.io";
}

function pricingUrlFor(ws: WorkspaceRow): string {
  return `${appUrlFor(ws)}/pricing`;
}

function resolveEmail(events: EventRow[]): string | null {
  for (const ev of events) {
    if (ev.email?.trim()) return ev.email.trim();
    const props = ev.properties ?? {};
    const fromProps = props.email;
    if (typeof fromProps === "string" && fromProps.trim()) {
      return fromProps.trim();
    }
  }
  return null;
}

type UserContext = {
  user_id: string;
  email: string;
  stage: LifecycleStage;
  events: EventRow[];
  score: number;
};

type EmailPlan = {
  trigger: EmailTrigger;
  subject: string;
  react: React.ReactElement;
};

/**
 * Pick the single email for tonight based on lifecycle stage.
 * Returns null when no email should be sent for this user tonight.
 */
export function planStageEmail(
  user: UserContext,
  ws: WorkspaceRow
): EmailPlan | null {
  const productName = ws.product_name ?? ws.name;
  const appUrl = appUrlFor(ws);
  const pricingUrl = pricingUrlFor(ws);
  const keyFeature = ws.key_feature_name ?? "the key feature";
  const displayName = user.email.split("@")[0] || user.email;
  const evts = user.events;

  switch (user.stage) {
    case "paid":
      return null;

    case "signup":
      return {
        trigger: "welcome",
        subject: `Welcome to ${productName}`,
        react: React.createElement(WelcomeEmail, {
          userName: displayName,
          appUrl,
          productName,
        }),
      };

    case "onboarding": {
      const featureUsedIn5d = evts.some(
        (e) =>
          isFeatureUsed(e.event_type) &&
          new Date(e.occurred_at).getTime() >= msAgo(5)
      );
      if (featureUsedIn5d) return null;
      return {
        trigger: "feature_nudge",
        subject: `Try ${keyFeature} in ${productName}`,
        react: React.createElement(FeatureNudgeEmail, {
          userName: displayName,
          keyFeatureName: keyFeature,
          appUrl,
          productName,
        }),
      };
    }

    case "active": {
      const pageViews7d = evts.filter(
        (e) =>
          isPageView(e.event_type) &&
          new Date(e.occurred_at).getTime() >= msAgo(7)
      ).length;
      if (pageViews7d < 3) return null;
      return {
        trigger: "value_demo",
        subject: `You're exploring ${productName} — nice work`,
        react: React.createElement(ValueDemoEmail, {
          userName: displayName,
          appUrl,
          productName,
        }),
      };
    }

    case "going_quiet":
      return {
        trigger: "check_in",
        subject: `Checking in on your ${productName} account`,
        react: React.createElement(CheckInEmail, {
          userName: displayName,
          appUrl,
          productName,
        }),
      };

    case "conversion_ready": {
      const visitedPricing = evts.some((e) => isPricingVisit(e));
      if (visitedPricing) {
        return {
          trigger: "urgency",
          subject: `Questions about ${productName} pricing?`,
          react: React.createElement(UrgencyEmail, {
            userName: displayName,
            pricingUrl,
            productName,
          }),
        };
      }
      return {
        trigger: "upgrade_offer",
        subject: `You're ready to upgrade ${productName}`,
        react: React.createElement(UpgradeOfferEmail, {
          userName: displayName,
          score: user.score,
          checkoutUrl: pricingUrl,
          appUrl,
          productName,
        }),
      };
    }

    case "churned":
      return {
        trigger: "churn_prevention",
        subject: `We'd love to see you back on ${productName}`,
        react: React.createElement(ChurnPreventionEmail, {
          userName: displayName,
          appUrl,
          productName,
        }),
      };

    default:
      return null;
  }
}

export async function runAutomatedEmails(): Promise<RunAutomatedEmailsResult> {
  const supabase = createSupabaseAdminClient();
  const result: RunAutomatedEmailsResult = { sent: 0, errors: [] };

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select(
      "id, name, product_name, website_url, key_feature_name, reply_to_email"
    )
    .not("reply_to_email", "is", null);

  if (wsError) {
    return { sent: 0, errors: [wsError.message] };
  }

  for (const ws of (workspaces ?? []) as WorkspaceRow[]) {
    if (!ws.reply_to_email?.trim()) continue;

    try {
      const [
        { data: stageRows, error: stageError },
        { data: events, error: evError },
        { data: scores },
      ] = await Promise.all([
        supabase
          .from("stages")
          .select("user_id, stage")
          .eq("workspace_id", ws.id),
        supabase
          .from("events")
          .select("user_id, email, event_type, page, properties, occurred_at")
          .eq("workspace_id", ws.id)
          .not("user_id", "is", null),
        supabase
          .from("engagement_scores")
          .select("user_id, score")
          .eq("workspace_id", ws.id),
      ]);

      if (stageError) {
        result.errors.push(`workspace:${ws.id} stages – ${stageError.message}`);
        continue;
      }
      if (evError) {
        result.errors.push(`workspace:${ws.id} events – ${evError.message}`);
        continue;
      }

      const scoreByUser = new Map<string, number>();
      for (const row of scores ?? []) {
        if (row.user_id) scoreByUser.set(row.user_id, row.score ?? 0);
      }

      const eventsByUser = new Map<string, EventRow[]>();
      for (const ev of (events ?? []) as EventRow[]) {
        if (!ev.user_id) continue;
        const list = eventsByUser.get(ev.user_id) ?? [];
        list.push(ev);
        eventsByUser.set(ev.user_id, list);
      }

      for (const row of (stageRows ?? []) as StageRow[]) {
        const userEvents = eventsByUser.get(row.user_id) ?? [];
        const email = resolveEmail(userEvents);
        if (!email || email.includes("@anon.")) continue;

        const user: UserContext = {
          user_id: row.user_id,
          email,
          stage: row.stage,
          events: userEvents,
          score: scoreByUser.get(row.user_id) ?? 0,
        };

        const plan = planStageEmail(user, ws);
        if (!plan) continue;

        const cooldown = COOLDOWN_HOURS[plan.trigger];
        if (
          await wasEmailSentRecently(
            ws.id,
            user.user_id,
            plan.trigger,
            cooldown
          )
        ) {
          continue;
        }

        const ok = await sendEmail({
          to: user.email,
          subject: plan.subject,
          react: plan.react,
          trigger: plan.trigger,
          workspaceId: ws.id,
          userId: user.user_id,
          replyTo: ws.reply_to_email,
          metadata: {
            recipient_email: user.email,
            stage: user.stage,
          },
        });

        if (ok) {
          result.sent++;
        } else {
          result.errors.push(
            `${ws.id}/${user.user_id}/${plan.trigger}`
          );
        }

        // At most one email per user per nightly run.
      }
    } catch (err) {
      result.errors.push(`workspace:${ws.id} – ${String(err)}`);
    }
  }

  return result;
}
