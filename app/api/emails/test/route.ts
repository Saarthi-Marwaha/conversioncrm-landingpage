/**
 * POST /api/emails/test
 *
 * Sends a test email to the given address (defaults to the workspace
 * reply-to) using the workspace's configured delivery provider, so SMTP
 * settings can be verified end-to-end from Settings.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { deliverEmail, usesSmtp, verifySmtp } from "@/lib/emails/transport";
import { workspaceSenderName } from "@/lib/emails/workspace-from";
import { escapeHtml } from "@/lib/emails/render-custom";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  to: z.string().trim().email().max(320).optional(),
});

// One test send per workspace per 30 seconds.
const lastTest = new Map<string, number>();

export async function POST(request: NextRequest) {
  const { workspace, userEmail } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  }

  const now = Date.now();
  if (now - (lastTest.get(workspace.id) ?? 0) < 30_000) {
    return NextResponse.json(
      { error: "Wait a moment between test emails." },
      { status: 429 }
    );
  }
  lastTest.set(workspace.id, now);

  const to =
    parsed.data.to || workspace.reply_to_email?.trim() || userEmail?.trim();
  if (!to) {
    return NextResponse.json(
      { error: "No recipient — set a reply-to email first." },
      { status: 400 }
    );
  }

  // For SMTP, verify the connection first so auth errors surface clearly.
  if (usesSmtp(workspace)) {
    const verifyError = await verifySmtp(workspace);
    if (verifyError) {
      return NextResponse.json(
        { error: `SMTP connection failed: ${verifyError}` },
        { status: 502 }
      );
    }
  }

  const sender = workspaceSenderName(workspace);
  const provider = usesSmtp(workspace) ? "your SMTP server" : "ConversionCRM (Resend)";
  const result = await deliverEmail(workspace, {
    to,
    subject: `Test email from ${sender}`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#eff8ff;padding:32px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
        <h1 style="font-size:18px;color:#0b3a5e;margin:0 0 12px;">Delivery works 🎉</h1>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 8px;">
          This test email was sent via <strong>${escapeHtml(provider)}</strong>
          for the workspace <strong>${escapeHtml(workspace.name)}</strong>.
        </p>
        <p style="font-size:13px;color:#6b7280;margin:16px 0 0;">Automated lifecycle emails and composer sends will use this exact route.</p>
      </div></body></html>`,
    replyTo: workspace.reply_to_email,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: `Send failed (${result.provider}): ${result.error}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, provider: result.provider, to });
}
