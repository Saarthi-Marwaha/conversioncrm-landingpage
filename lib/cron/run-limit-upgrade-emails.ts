/**
 * Nightly limit-upgrade emails — sent only for users who exhausted a free
 * allowance (trial / weekly / monthly / quota). Signals are queued on event
 * ingest; this job sends at most one limit email per user per night.
 */
import React from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail, wasLimitUpgradeSentRecently } from "@/lib/emails/send";
import { LimitUpgradeEmail } from "@/emails/templates/LimitUpgrade";
import {
  limitTypeLabel,
  limitUpgradeCooldownHours,
  type UsageLimitType,
} from "@/lib/emails/limit-events";

export type RunLimitUpgradeEmailsResult = {
  sent: number;
  errors: string[];
};

type WorkspaceRow = {
  id: string;
  name: string;
  product_name: string | null;
  website_url: string | null;
  reply_to_email: string | null;
  email_sender_name: string | null;
};

type PendingSignal = {
  id: string;
  workspace_id: string;
  user_id: string;
  limit_type: UsageLimitType;
  hit_at: string;
};

type EventRow = {
  user_id: string | null;
  email: string | null;
  properties: Record<string, unknown> | null;
};

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
    const fromProps = ev.properties?.email;
    if (typeof fromProps === "string" && fromProps.trim()) {
      return fromProps.trim();
    }
  }
  return null;
}

export async function runLimitUpgradeEmails(): Promise<RunLimitUpgradeEmailsResult> {
  const supabase = createSupabaseAdminClient();
  const result: RunLimitUpgradeEmailsResult = { sent: 0, errors: [] };

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id, name, product_name, website_url, reply_to_email, email_sender_name")
    .not("reply_to_email", "is", null);

  if (wsError) {
    return { sent: 0, errors: [wsError.message] };
  }

  for (const ws of (workspaces ?? []) as WorkspaceRow[]) {
    if (!ws.reply_to_email?.trim()) continue;

    const { data: pending, error: pendingError } = await supabase
      .from("usage_limit_signals")
      .select("id, workspace_id, user_id, limit_type, hit_at")
      .eq("workspace_id", ws.id)
      .is("email_sent_at", null)
      .order("hit_at", { ascending: true });

    if (pendingError) {
      result.errors.push(`workspace:${ws.id} signals – ${pendingError.message}`);
      continue;
    }

    if (!pending?.length) continue;

    const userIds = Array.from(new Set(pending.map((p) => p.user_id)));

    const [{ data: stageRows }, { data: events }] = await Promise.all([
      supabase
        .from("stages")
        .select("user_id, stage")
        .eq("workspace_id", ws.id)
        .in("user_id", userIds),
      supabase
        .from("events")
        .select("user_id, email, properties")
        .eq("workspace_id", ws.id)
        .in("user_id", userIds),
    ]);

    const paidUsers = new Set(
      (stageRows ?? [])
        .filter((r) => r.stage === "paid")
        .map((r) => r.user_id)
    );

    const eventsByUser = new Map<string, EventRow[]>();
    for (const ev of (events ?? []) as EventRow[]) {
      if (!ev.user_id) continue;
      const list = eventsByUser.get(ev.user_id) ?? [];
      list.push(ev);
      eventsByUser.set(ev.user_id, list);
    }

    const emailedTonight = new Set<string>();

    for (const signal of pending as PendingSignal[]) {
      if (emailedTonight.has(signal.user_id)) continue;
      if (paidUsers.has(signal.user_id)) {
        await supabase
          .from("usage_limit_signals")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", signal.id);
        continue;
      }

      const email = resolveEmail(eventsByUser.get(signal.user_id) ?? []);
      if (!email || email.includes("@anon.")) continue;

      const cooldown = limitUpgradeCooldownHours(signal.limit_type);
      if (
        await wasLimitUpgradeSentRecently(
          ws.id,
          signal.user_id,
          signal.limit_type,
          cooldown
        )
      ) {
        await supabase
          .from("usage_limit_signals")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", signal.id);
        continue;
      }

      const productName = ws.product_name ?? ws.name;
      const displayName = email.split("@")[0] || email;
      const limitLabel = limitTypeLabel(signal.limit_type);

      const ok = await sendEmail({
        to: email,
        subject: `Your ${limitLabel} on ${productName} has ended`,
        react: React.createElement(LimitUpgradeEmail, {
          userName: displayName,
          limitLabel,
          checkoutUrl: pricingUrlFor(ws),
          appUrl: appUrlFor(ws),
          productName,
        }),
        trigger: "limit_upgrade",
        workspaceId: ws.id,
        userId: signal.user_id,
        replyTo: ws.reply_to_email,
        workspace: ws,
        metadata: {
          recipient_email: email,
          limit_type: signal.limit_type,
          hit_at: signal.hit_at,
        },
      });

      if (ok) {
        result.sent++;
        emailedTonight.add(signal.user_id);
      } else {
        result.errors.push(
          `${ws.id}/${signal.user_id}/limit_upgrade/${signal.limit_type}`
        );
        continue;
      }

      await supabase
        .from("usage_limit_signals")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", signal.id);
    }
  }

  return result;
}
