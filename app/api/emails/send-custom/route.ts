/**
 * POST /api/emails/send-custom
 *
 * Sends a hand-composed email built in the dashboard composer — to a
 * single address, to every user in a lifecycle stage, or to everyone.
 *
 * Auth: dashboard session (active workspace). The HTML is rendered
 * server-side from validated plain-text fields — client HTML is never
 * accepted — and every send is logged to email_logs (trigger 'custom')
 * with the rendered HTML so user profiles can show what was sent.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { workspaceSenderName } from "@/lib/emails/workspace-from";
import { deliverEmail } from "@/lib/emails/transport";
import { listRecipients, type Recipient } from "@/lib/emails/recipients";
import { renderCustomEmailHtml, sanitizeTheme } from "@/lib/emails/render-custom";
import { getQuotaState } from "@/lib/usage";
import { planAllows, upgradeMessage } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  .optional();

const BodySchema = z
  .object({
    /** Single recipient address (individual / custom sends). */
    to: z.string().trim().email().max(320).optional(),
    /** Bulk audience: everyone, or one lifecycle stage. */
    audience: z
      .enum([
        "all",
        "signup",
        "onboarding",
        "active",
        "going_quiet",
        "conversion_ready",
        "paid",
        "churned",
      ])
      .optional(),
    subject: z.string().trim().min(1).max(200),
    preheader: z.string().trim().max(200).optional(),
    heading: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1).max(8000),
    ctaLabel: z.string().trim().max(80).optional(),
    ctaUrl: z.string().trim().max(500).optional(),
    footerText: z.string().trim().max(300).optional(),
    /** Tracked widget user id, when composing from a profile. */
    userId: z.string().trim().max(256).optional(),
    theme: z
      .object({
        accent: hexColor,
        background: hexColor,
        surface: hexColor,
        text: hexColor,
        muted: hexColor,
        accentText: hexColor,
      })
      .optional(),
  })
  .refine((v) => !!v.to !== !!v.audience, {
    message: "Provide either a recipient or an audience",
  });

// Best-effort in-memory limiters (per serverless instance).
const SINGLE_LIMIT = 20; // single sends per workspace per hour
const BULK_LIMIT = 3; // bulk (all / stage) sends per workspace per hour
const MAX_BULK_RECIPIENTS = 500;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const singleSends = new Map<string, number[]>();
const bulkSends = new Map<string, number[]>();

function rateLimited(
  store: Map<string, number[]>,
  workspaceId: string,
  limit: number
): boolean {
  const now = Date.now();
  const recent = (store.get(workspaceId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (recent.length >= limit) {
    store.set(workspaceId, recent);
    return true;
  }
  recent.push(now);
  store.set(workspaceId, recent);
  return false;
}

export async function POST(request: NextRequest) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // The hand-written composer is a paid feature (Basic and above).
  if (!planAllows(workspace.plan, "custom_composer")) {
    return NextResponse.json(
      { error: upgradeMessage("custom_composer"), upgrade: true },
      { status: 403 }
    );
  }

  // Respect the monthly email cap. Sending stops at the limit; data keeps
  // being collected regardless.
  const quota = await getQuotaState(workspace);
  if (quota.remaining <= 0) {
    return NextResponse.json(
      {
        error: `Monthly email limit reached (${quota.used.toLocaleString()}/${quota.quota.toLocaleString()}). Upgrade to send more — your data is still being collected.`,
        upgrade: true,
      },
      { status: 402 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".") || "body"}: ${issue.message}` },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const isBulk = !!input.audience;

  if (isBulk) {
    if (rateLimited(bulkSends, workspace.id, BULK_LIMIT)) {
      return NextResponse.json(
        { error: "Bulk send limit reached — try again in a bit (3/hour)." },
        { status: 429 }
      );
    }
  } else if (rateLimited(singleSends, workspace.id, SINGLE_LIMIT)) {
    return NextResponse.json(
      { error: "Rate limit reached — try again in a bit (20 sends/hour)." },
      { status: 429 }
    );
  }

  const theme = sanitizeTheme(input.theme);
  const html = renderCustomEmailHtml(
    {
      subject: input.subject,
      preheader: input.preheader,
      heading: input.heading,
      body: input.body,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      footerText: input.footerText,
      senderName: workspaceSenderName(workspace),
    },
    theme
  );

  const supabase = createSupabaseAdminClient();

  // ── Resolve recipients ─────────────────────────────────────────
  let recipients: { user_id: string | null; email: string }[];
  if (isBulk) {
    const audienceList: Recipient[] = await listRecipients(workspace.id);
    recipients = (
      input.audience === "all"
        ? audienceList
        : audienceList.filter((r) => r.stage === input.audience)
    ).slice(0, Math.min(MAX_BULK_RECIPIENTS, quota.remaining));

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No users with an email address in that audience yet." },
        { status: 400 }
      );
    }
  } else {
    // Associate the send with a tracked user so it appears in their
    // profile's history — explicit id wins, else match by email.
    let userId = input.userId ?? null;
    if (!userId) {
      const { data: evRow } = await supabase
        .from("events")
        .select("user_id")
        .eq("workspace_id", workspace.id)
        .eq("email", input.to!)
        .not("user_id", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      userId = evRow?.user_id ?? null;
    }
    recipients = [{ user_id: userId, email: input.to! }];
  }

  // ── Send + log ─────────────────────────────────────────────────
  const sentAt = new Date().toISOString();
  let sent = 0;
  const failures: string[] = [];
  const logRows: Record<string, unknown>[] = [];

  // Custom sending domain (SMTP) is Pro+. Lower plans fall back to Resend.
  const deliveryWorkspace =
    workspace.email_provider === "smtp" &&
    !planAllows(workspace.plan, "custom_smtp")
      ? { ...workspace, email_provider: "resend" as const }
      : workspace;

  for (const r of recipients) {
    const result = await deliverEmail(deliveryWorkspace, {
      to: r.email,
      subject: input.subject,
      html,
      replyTo: workspace.reply_to_email,
    });

    if (result.ok) sent++;
    else failures.push(`${r.email}: ${result.error}`);

    logRows.push({
      workspace_id: workspace.id,
      user_id: r.user_id,
      end_user_id: null,
      trigger: "custom",
      resend_message_id: result.messageId,
      subject: input.subject,
      status: result.ok ? "sent" : "failed",
      sent_at: sentAt,
      metadata: {
        recipient_email: r.email,
        html,
        body_text: input.body,
        theme,
        composed: true,
        provider: result.provider,
        ...(isBulk ? { audience: input.audience } : {}),
        ...(result.error ? { error: result.error } : {}),
      },
    });
  }

  const { error: logError } = await supabase.from("email_logs").insert(logRows);
  if (logError) {
    console.error("[/api/emails/send-custom] log insert:", logError.message);
  }

  if (sent === 0) {
    const firstError = failures[0] ?? "Unknown delivery error";
    console.error("[/api/emails/send-custom] all sends failed:", firstError);
    return NextResponse.json(
      { error: `Send failed: ${firstError}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed: failures.length,
    total: recipients.length,
  });
}
