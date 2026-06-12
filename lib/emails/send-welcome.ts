/**
 * Immediate welcome email — fired on signup events from the widget,
 * not waiting for nightly cron or dashboard batch.
 */
import React from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail, wasEmailSentRecently } from "@/lib/emails/send";
import { WelcomeEmail } from "@/emails/templates/Welcome";

export function isSignupEventType(eventType: string): boolean {
  return /sign[_-]?up|register/i.test(eventType);
}

function appUrlFor(ws: {
  website_url: string | null;
}): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (ws.website_url) return ws.website_url.replace(/\/+$/, "");
  return configured || "https://app.conversioncrm.io";
}

/**
 * Sends the welcome email once per user when a signup event is ingested.
 * No-op if reply-to is missing, email is absent, or welcome was already sent.
 */
export async function maybeSendWelcomeOnSignup(
  workspaceId: string,
  userId: string,
  email: string | null
): Promise<boolean> {
  const trimmed = email?.trim();
  if (!trimmed || trimmed.includes("@anon.")) return false;

  const supabase = createSupabaseAdminClient();
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, product_name, website_url, reply_to_email, email_sender_name")
    .eq("id", workspaceId)
    .single();

  if (!ws?.reply_to_email?.trim()) return false;

  if (await wasEmailSentRecently(workspaceId, userId, "welcome", null)) {
    return false;
  }

  const productName = ws.product_name ?? ws.name;
  const displayName = trimmed.split("@")[0] || trimmed;

  return sendEmail({
    to: trimmed,
    subject: `Welcome to ${productName}`,
    react: React.createElement(WelcomeEmail, {
      userName: displayName,
      appUrl: appUrlFor(ws),
      productName,
    }),
    trigger: "welcome",
    workspaceId,
    userId,
    replyTo: ws.reply_to_email,
    workspace: ws,
    metadata: {
      recipient_email: trimmed,
      stage: "signup",
      sent_on: "signup_event",
    },
  });
}
