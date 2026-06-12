/**
 * Unified outbound email delivery.
 *
 * Every email in the product flows through deliverEmail(), which picks the
 * workspace's configured provider:
 *   • resend (default) — platform sender via the Resend API
 *   • smtp             — the customer's own SMTP server (nodemailer)
 *
 * SMTP lets customers send from their own domain/inbox provider (Gmail,
 * Outlook, SES, Postmark SMTP, etc.) without us holding domain DNS.
 */
import nodemailer from "nodemailer";
import { getResend, DEFAULT_FROM_EMAIL } from "@/lib/resend";
import { workspaceSenderName } from "@/lib/emails/workspace-from";

export type DeliveryWorkspace = {
  id: string;
  name: string | null;
  product_name?: string | null;
  email_sender_name?: string | null;
  reply_to_email?: string | null;
  email_provider?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_pass?: string | null;
  smtp_secure?: boolean | null;
  smtp_from_email?: string | null;
};

export type DeliveryResult = {
  ok: boolean;
  provider: "resend" | "smtp";
  messageId: string | null;
  error: string | null;
};

export function smtpConfigured(ws: DeliveryWorkspace): boolean {
  return !!(ws.smtp_host?.trim() && ws.smtp_port && ws.smtp_user?.trim() && ws.smtp_pass);
}

export function usesSmtp(ws: DeliveryWorkspace): boolean {
  return ws.email_provider === "smtp" && smtpConfigured(ws);
}

function smtpFromAddress(ws: DeliveryWorkspace): string {
  const email = ws.smtp_from_email?.trim() || ws.smtp_user?.trim() || DEFAULT_FROM_EMAIL;
  return `${workspaceSenderName(ws)} <${email}>`;
}

function resendFromAddress(ws: DeliveryWorkspace): string {
  return `${workspaceSenderName(ws)} <${DEFAULT_FROM_EMAIL}>`;
}

export async function deliverEmail(
  ws: DeliveryWorkspace,
  opts: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string | null;
  }
): Promise<DeliveryResult> {
  if (usesSmtp(ws)) {
    try {
      const transporter = nodemailer.createTransport({
        host: ws.smtp_host!.trim(),
        port: ws.smtp_port!,
        secure: !!ws.smtp_secure,
        auth: { user: ws.smtp_user!.trim(), pass: ws.smtp_pass! },
        connectionTimeout: 10_000,
        socketTimeout: 15_000,
      });
      const info = await transporter.sendMail({
        from: smtpFromAddress(ws),
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      });
      return {
        ok: true,
        provider: "smtp",
        messageId: info.messageId ?? null,
        error: null,
      };
    } catch (err) {
      return {
        ok: false,
        provider: "smtp",
        messageId: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: resendFromAddress(ws),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    });
    return {
      ok: !error,
      provider: "resend",
      messageId: data?.id ?? null,
      error: error ? (error.message ?? String(error)) : null,
    };
  } catch (err) {
    return {
      ok: false,
      provider: "resend",
      messageId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Verifies SMTP credentials without sending (used by the Settings test). */
export async function verifySmtp(ws: DeliveryWorkspace): Promise<string | null> {
  if (!smtpConfigured(ws)) return "SMTP is not fully configured";
  try {
    const transporter = nodemailer.createTransport({
      host: ws.smtp_host!.trim(),
      port: ws.smtp_port!,
      secure: !!ws.smtp_secure,
      auth: { user: ws.smtp_user!.trim(), pass: ws.smtp_pass! },
      connectionTimeout: 10_000,
    });
    await transporter.verify();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
