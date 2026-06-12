/**
 * POST /api/emails/send-custom
 *
 * Sends a hand-composed email built in the dashboard composer.
 * Auth: dashboard session (active workspace). The HTML is rendered
 * server-side from validated plain-text fields — client HTML is never
 * accepted — and the send is logged to email_logs (trigger 'custom')
 * with the rendered HTML so the user profile can show what was sent.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { workspaceSenderName } from "@/lib/emails/workspace-from";
import { deliverEmail } from "@/lib/emails/transport";
import { renderCustomEmailHtml, sanitizeTheme } from "@/lib/emails/render-custom";

export const dynamic = "force-dynamic";

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  .optional();

const BodySchema = z.object({
  to: z.string().trim().email().max(320),
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
});

// Best-effort in-memory limiter (per serverless instance): caps composer
// sends to 20 per workspace per hour so a stuck client can't drain quota.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const sendTimestamps = new Map<string, number[]>();

function rateLimited(workspaceId: string): boolean {
  const now = Date.now();
  const recent = (sendTimestamps.get(workspaceId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT) {
    sendTimestamps.set(workspaceId, recent);
    return true;
  }
  recent.push(now);
  sendTimestamps.set(workspaceId, recent);
  return false;
}

export async function POST(request: NextRequest) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

  if (rateLimited(workspace.id)) {
    return NextResponse.json(
      { error: "Rate limit reached — try again in a bit (20 sends/hour)." },
      { status: 429 }
    );
  }

  const input = parsed.data;
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
  const sentAt = new Date().toISOString();

  // Associate the send with a tracked user so it appears in their profile's
  // email history — explicit id wins, otherwise match by recipient email.
  let userId = input.userId ?? null;
  if (!userId) {
    const { data: evRow } = await supabase
      .from("events")
      .select("user_id")
      .eq("workspace_id", workspace.id)
      .eq("email", input.to)
      .not("user_id", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    userId = evRow?.user_id ?? null;
  }

  const result = await deliverEmail(workspace, {
    to: input.to,
    subject: input.subject,
    html,
    replyTo: workspace.reply_to_email,
  });

  const { error: logError } = await supabase.from("email_logs").insert({
    workspace_id: workspace.id,
    user_id: userId,
    end_user_id: null,
    trigger: "custom",
    resend_message_id: result.messageId,
    subject: input.subject,
    status: result.ok ? "sent" : "failed",
    sent_at: sentAt,
    metadata: {
      recipient_email: input.to,
      html,
      body_text: input.body,
      theme,
      composed: true,
      provider: result.provider,
      ...(result.error ? { error: result.error } : {}),
    },
  });
  if (logError) {
    console.error("[/api/emails/send-custom] log insert:", logError.message);
  }

  if (!result.ok) {
    console.error("[/api/emails/send-custom] send failed:", result.error);
    return NextResponse.json(
      {
        error:
          result.provider === "smtp"
            ? `SMTP send failed: ${result.error}`
            : "Email provider rejected the send. Check your delivery settings.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}
