import { getResend, EMAIL_FROM } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { EmailTrigger, EndUser, Workspace } from "@/types";

interface SendEmailOptions {
  to: string;
  subject: string;
  react: React.ReactElement;
  trigger: EmailTrigger;
  workspaceId: string;
  endUserId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Sends a transactional email via Resend and logs it to the email_logs table.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, react, trigger, workspaceId, endUserId, metadata } =
    options;

  try {
    const { data, error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      react,
    });

    const supabase = createSupabaseAdminClient();

    await supabase.from("email_logs").insert({
      workspace_id: workspaceId,
      end_user_id: endUserId,
      trigger,
      resend_message_id: data?.id ?? null,
      subject,
      status: error ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      metadata: metadata ?? {},
    });

    if (error) {
      console.error(`[Email] Failed to send ${trigger}:`, error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Email] Unexpected error sending ${trigger}:`, err);
    return false;
  }
}

/**
 * Checks if a specific trigger email was already sent to a user recently.
 * Prevents duplicate sends within a given window.
 */
export async function wasEmailSentRecently(
  endUserId: string,
  trigger: EmailTrigger,
  withinHours = 24
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(
    Date.now() - withinHours * 60 * 60 * 1000
  ).toISOString();

  const { count } = await supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("end_user_id", endUserId)
    .eq("trigger", trigger)
    .eq("status", "sent")
    .gte("sent_at", cutoff);

  return (count ?? 0) > 0;
}
