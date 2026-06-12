import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { parseLimitExhaustedEvent } from "@/lib/emails/limit-events";

/**
 * Queue a limit-upgrade email when a user exhausts trial / period / quota.
 * Does not send immediately — nightly cron processes pending rows.
 */
export async function recordLimitSignalIfApplicable(
  workspaceId: string,
  userId: string | null,
  eventType: string,
  properties: Record<string, unknown> | null | undefined
): Promise<void> {
  if (!userId) return;

  const parsed = parseLimitExhaustedEvent(eventType, properties);
  if (!parsed) return;

  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("usage_limit_signals")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("limit_type", parsed.limit_type)
    .is("email_sent_at", null)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("usage_limit_signals")
      .update({
        hit_at: new Date().toISOString(),
        event_type: parsed.event_type,
        metadata: properties ?? {},
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("usage_limit_signals").insert({
    workspace_id: workspaceId,
    user_id: userId,
    limit_type: parsed.limit_type,
    event_type: parsed.event_type,
    metadata: properties ?? {},
    hit_at: new Date().toISOString(),
  });
}
