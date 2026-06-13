/**
 * Reusable typed query helpers that wrap Supabase calls.
 * Always use the admin client in server-only contexts.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { EndUser, Event, Workspace } from "@/types";

// ─────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────

export async function getWorkspaceByApiKey(
  apiKey: string
): Promise<Workspace | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("api_key", apiKey)
    .single();
  return data ?? null;
}

export async function getWorkspaceByOwnerId(
  ownerId: string
): Promise<Workspace | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", ownerId)
    .single();
  return data ?? null;
}

export async function getWorkspaceById(
  workspaceId: string
): Promise<Workspace | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();
  return data ?? null;
}

/** Fields the billing layer is allowed to write on a workspace. */
export type WorkspacePlanUpdate = Partial<
  Pick<
    Workspace,
    | "plan"
    | "email_quota"
    | "plan_status"
    | "plan_selected_at"
    | "razorpay_customer_id"
    | "razorpay_subscription_id"
    | "plan_renews_at"
  >
>;

export async function updateWorkspacePlan(
  workspaceId: string,
  fields: WorkspacePlanUpdate
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("workspaces")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", workspaceId);
}

/** Maps a Razorpay subscription id back to its workspace (webhook lookup). */
export async function getWorkspaceByRazorpaySubscription(
  subscriptionId: string
): Promise<Workspace | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("razorpay_subscription_id", subscriptionId)
    .maybeSingle();
  return data ?? null;
}

// ─────────────────────────────────────────────
// End Users
// ─────────────────────────────────────────────

export async function upsertEndUser(params: {
  workspaceId: string;
  externalId: string;
  email: string;
  name?: string;
  metadata?: Record<string, unknown>;
}): Promise<EndUser | null> {
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("end_users")
    .upsert(
      {
        workspace_id: params.workspaceId,
        external_id: params.externalId,
        email: params.email,
        name: params.name,
        last_seen_at: new Date().toISOString(),
        metadata: params.metadata ?? {},
      },
      {
        onConflict: "workspace_id,external_id",
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  return data ?? null;
}

export async function getEndUsersByWorkspace(
  workspaceId: string,
  limit = 100
): Promise<EndUser[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("end_users")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function updateEndUserScore(
  endUserId: string,
  score: number,
  stage: EndUser["stage"]
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("end_users")
    .update({ engagement_score: score, stage, updated_at: new Date().toISOString() })
    .eq("id", endUserId);
}

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────

export async function insertEvent(params: {
  workspaceId: string;
  endUserId: string;
  eventType: Event["event_type"];
  eventName: string;
  properties?: Record<string, unknown>;
  occurredAt?: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from("events").insert({
    workspace_id: params.workspaceId,
    end_user_id: params.endUserId,
    event_type: params.eventType,
    event_name: params.eventName,
    properties: params.properties ?? {},
    occurred_at: params.occurredAt ?? new Date().toISOString(),
  });
}

export async function getRecentEventsForUser(
  endUserId: string,
  limitDays = 14
): Promise<Event[]> {
  const supabase = createSupabaseAdminClient();
  const since = new Date(
    Date.now() - limitDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("end_user_id", endUserId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false });

  return data ?? [];
}

// ─────────────────────────────────────────────
// Dashboard aggregates
// ─────────────────────────────────────────────

export async function getStageCounts(
  workspaceId: string
): Promise<Record<string, number>> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("end_users")
    .select("stage")
    .eq("workspace_id", workspaceId);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.stage] = (counts[row.stage] ?? 0) + 1;
  }
  return counts;
}

export async function getConversionRate7d(
  workspaceId: string
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: total }, { count: converted }] = await Promise.all([
    supabase
      .from("end_users")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", since),
    supabase
      .from("end_users")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("stage", "paid")
      .gte("converted_at", since),
  ]);

  if (!total || total === 0) return 0;
  return Math.round(((converted ?? 0) / total) * 100);
}
