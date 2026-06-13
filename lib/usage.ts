/**
 * Monthly email-send quota — the hard cap that stops sending once a
 * workspace exhausts its plan's allowance for the calendar month.
 *
 * Data collection (the tracking widget → /api/events) is intentionally NOT
 * gated here: even a workspace that has blown past its email quota keeps
 * ingesting events, scores and profiles. Only outbound *email* stops.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { planById, type PlanId } from "@/lib/plans";

/** Minimal shape needed to resolve a workspace's effective plan + quota. */
export interface PlanBearingWorkspace {
  id: string;
  plan?: PlanId | string | null;
  email_quota?: number | null;
  plan_status?: string | null;
  plan_renews_at?: string | null;
}

/** Start of the current month in UTC, ISO string. */
export function startOfCurrentMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Resolve the plan + monthly quota that actually applies right now.
 * A cancelled / past-due subscription keeps its quota until the paid period
 * ends (plan_renews_at), then falls back to Free.
 */
export function effectivePlan(ws: PlanBearingWorkspace): {
  plan: PlanId;
  quota: number;
} {
  const planId = (ws.plan as PlanId) || "free";
  const def = planById(planId);

  const inGrace =
    ws.plan_status === "cancelled" || ws.plan_status === "past_due";
  if (inGrace) {
    const renews = ws.plan_renews_at ? Date.parse(ws.plan_renews_at) : 0;
    if (!renews || Date.now() > renews) {
      return { plan: "free", quota: planById("free").emailQuota };
    }
  }

  const quota =
    typeof ws.email_quota === "number" && ws.email_quota > 0
      ? ws.email_quota
      : def.emailQuota;
  return { plan: planId, quota };
}

/** Count of successfully-sent emails this calendar month for a workspace. */
export async function getMonthlyEmailUsage(workspaceId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("email_logs")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "sent")
    .gte("sent_at", startOfCurrentMonthIso());
  return count ?? 0;
}

export interface QuotaState {
  plan: PlanId;
  used: number;
  quota: number;
  remaining: number;
  allowed: boolean;
  /** 0–100, clamped. */
  percent: number;
}

/** Full quota snapshot for a workspace (used by the dashboard + gates). */
export async function getQuotaState(
  ws: PlanBearingWorkspace
): Promise<QuotaState> {
  const { plan, quota } = effectivePlan(ws);
  const used = await getMonthlyEmailUsage(ws.id);
  const remaining = Math.max(0, quota - used);
  return {
    plan,
    used,
    quota,
    remaining,
    allowed: used < quota,
    percent: quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 100,
  };
}

/**
 * Cheap pre-send gate: true when the workspace still has email headroom
 * this month. Used right before delivering any outbound email.
 */
export async function canSendEmail(ws: PlanBearingWorkspace): Promise<{
  allowed: boolean;
  used: number;
  quota: number;
  plan: PlanId;
}> {
  const { plan, quota } = effectivePlan(ws);
  const used = await getMonthlyEmailUsage(ws.id);
  return { allowed: used < quota, used, quota, plan };
}
