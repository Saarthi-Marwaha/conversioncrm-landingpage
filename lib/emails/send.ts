import type React from "react";
import { render } from "@react-email/render";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deliverEmail, type DeliveryWorkspace } from "@/lib/emails/transport";
import type { EmailTrigger } from "@/types";

interface SendEmailOptions {
  to: string;
  subject: string;
  react: React.ReactElement;
  trigger: EmailTrigger;
  workspaceId: string;
  /** Widget-tracked user id (preferred for automated emails). */
  userId?: string | null;
  /** Legacy end_users row id. */
  endUserId?: string | null;
  replyTo?: string | null;
  /** Workspace row fields used to build a per-customer From display name. */
  workspace?: {
    email_sender_name?: string | null;
    product_name?: string | null;
    name?: string | null;
  } | null;
  /** Override From display name without a full workspace object. */
  fromName?: string | null;
  metadata?: Record<string, unknown>;
}

/** Workspace fields needed to pick + drive the delivery provider. */
const DELIVERY_FIELDS =
  "id, name, product_name, email_sender_name, reply_to_email, email_provider, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_from_email";

/**
 * Sends a transactional email through the workspace's configured provider
 * (customer SMTP or platform Resend) and logs it to email_logs.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const {
    to,
    subject,
    react,
    trigger,
    workspaceId,
    userId,
    endUserId,
    replyTo,
    workspace,
    fromName,
    metadata,
  } = options;

  const supabase = createSupabaseAdminClient();
  const sentAt = new Date().toISOString();

  // The full workspace row decides the provider (SMTP vs Resend); partial
  // rows passed by callers don't carry SMTP credentials.
  const { data: wsRow } = await supabase
    .from("workspaces")
    .select(DELIVERY_FIELDS)
    .eq("id", workspaceId)
    .maybeSingle();

  const delivery: DeliveryWorkspace = {
    ...(wsRow as DeliveryWorkspace | null),
    id: workspaceId,
    name: wsRow?.name ?? workspace?.name ?? null,
    email_sender_name:
      workspace?.email_sender_name ??
      fromName ??
      (wsRow as DeliveryWorkspace | null)?.email_sender_name,
    product_name:
      workspace?.product_name ?? (wsRow as DeliveryWorkspace | null)?.product_name,
  };

  try {
    const html = await render(react);
    const result = await deliverEmail(delivery, {
      to,
      subject,
      html,
      replyTo: replyTo ?? delivery.reply_to_email,
    });

    await supabase.from("email_logs").insert({
      workspace_id: workspaceId,
      user_id: userId ?? null,
      end_user_id: endUserId ?? null,
      trigger,
      resend_message_id: result.messageId,
      subject,
      status: result.ok ? "sent" : "failed",
      sent_at: sentAt,
      metadata: {
        ...(metadata ?? {}),
        provider: result.provider,
        ...(result.error ? { error: result.error } : {}),
      },
    });

    if (!result.ok) {
      console.error(`[Email] Failed to send ${trigger}:`, result.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Email] Unexpected error sending ${trigger}:`, err);

    await supabase.from("email_logs").insert({
      workspace_id: workspaceId,
      user_id: userId ?? null,
      end_user_id: endUserId ?? null,
      trigger,
      resend_message_id: null,
      subject,
      status: "failed",
      sent_at: sentAt,
      metadata: { ...(metadata ?? {}), error: String(err) },
    });

    return false;
  }
}

/**
 * True if a successful send exists for this user + trigger within the window.
 * Pass `withinHours: null` to check if it was ever sent.
 */
export async function wasEmailSentRecently(
  workspaceId: string,
  userId: string,
  trigger: EmailTrigger,
  withinHours: number | null = 24
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("trigger", trigger)
    .eq("status", "sent");

  if (withinHours !== null) {
    const cutoff = new Date(
      Date.now() - withinHours * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("sent_at", cutoff);
  }

  const { count } = await query;
  return (count ?? 0) > 0;
}

/** Cooldown scoped to limit_type metadata on limit_upgrade sends. */
export async function wasLimitUpgradeSentRecently(
  workspaceId: string,
  userId: string,
  limitType: string,
  withinHours: number | null
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("trigger", "limit_upgrade")
    .eq("status", "sent")
    .contains("metadata", { limit_type: limitType });

  if (withinHours !== null) {
    const cutoff = new Date(
      Date.now() - withinHours * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("sent_at", cutoff);
  }

  const { count } = await query;
  return (count ?? 0) > 0;
}
