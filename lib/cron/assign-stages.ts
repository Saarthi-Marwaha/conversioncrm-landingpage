/**
 * Lifecycle stage assignment — runs after nightly scoring.
 *
 * Priority (first match wins, except Paid is sticky forever):
 *   1. Paid      — any historical event_type = "paid" (never downgrade)
 *   2. Churned   — no events in the last 30 days
 *   3. Going Quiet — had a score last week, no events in the last 14 days
 *   4. Conversion Ready — score 71–100
 *   5. Active    — score 31–70
 *   6. Onboarding — score 1–30
 *   7. Signup    — user exists in events but score is 0 or null
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { LifecycleStage } from "@/types";
import { daysAgo } from "@/lib/utils";
import type { ScoredUser } from "@/lib/cron/run-scoring";

export type AssignStagesResult = {
  assigned: number;
  errors: string[];
};

type UserStageInput = {
  score: number | null;
  hasPaidEvent: boolean;
  currentStage: LifecycleStage | null;
  lastEventAt: string | null;
  hadScoreLastWeek: boolean;
  hasAnyEvent: boolean;
};

/** Exported for unit testing. */
export function resolveStage(input: UserStageInput): LifecycleStage {
  if (input.hasPaidEvent || input.currentStage === "paid") {
    return "paid";
  }

  const now = Date.now();
  const lastMs = input.lastEventAt ? new Date(input.lastEventAt).getTime() : null;
  const daysSinceLastEvent =
    lastMs === null ? Infinity : (now - lastMs) / (1000 * 60 * 60 * 24);

  if (input.hasAnyEvent && daysSinceLastEvent > 30) {
    return "churned";
  }

  if (
    input.hadScoreLastWeek &&
    input.hasAnyEvent &&
    daysSinceLastEvent > 14
  ) {
    return "going_quiet";
  }

  const score = input.score ?? 0;

  if (score >= 71) return "conversion_ready";
  if (score >= 31) return "active";
  if (score >= 1) return "onboarding";

  return "signup";
}

export type WorkspaceStageResult = {
  stages: Map<string, LifecycleStage>;
  assigned: number;
  error?: string;
};

/**
 * Assign lifecycle stages for one workspace and upsert to `stages`.
 * Uses full event history for churn / going-quiet rules; `justScored`
 * overrides scores from the latest engagement run.
 */
export async function assignStagesForWorkspace(
  workspaceId: string,
  justScored: ScoredUser[] = []
): Promise<WorkspaceStageResult> {
  const supabase = createSupabaseAdminClient();
  const scoreByUser = new Map(
    justScored.map((u) => [u.user_id, u.score] as const)
  );

  const scoreWeekAgoCutoff = daysAgo(7);

  const [eventsRes, paidRes, scoresRes, stagesRes] = await Promise.all([
    supabase
      .from("events")
      .select("user_id, event_type, occurred_at")
      .eq("workspace_id", workspaceId)
      .not("user_id", "is", null),
    supabase
      .from("events")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("event_type", "paid")
      .not("user_id", "is", null),
    supabase
      .from("engagement_scores")
      .select("user_id, score, computed_at")
      .eq("workspace_id", workspaceId),
    supabase
      .from("stages")
      .select("user_id, stage")
      .eq("workspace_id", workspaceId),
  ]);

  if (eventsRes.error) {
    return {
      stages: new Map(),
      assigned: 0,
      error: eventsRes.error.message,
    };
  }

  const userIds = new Set<string>();
  for (const ev of eventsRes.data ?? []) {
    if (ev.user_id) userIds.add(ev.user_id);
  }
  for (const u of justScored) {
    userIds.add(u.user_id);
  }

  if (userIds.size === 0) {
    return { stages: new Map(), assigned: 0 };
  }

  const paidUsers = new Set(
    (paidRes.data ?? []).map((r) => r.user_id).filter(Boolean) as string[]
  );

  const currentStage = new Map<string, LifecycleStage>();
  for (const row of stagesRes.data ?? []) {
    if (row.user_id && row.stage) {
      currentStage.set(row.user_id, row.stage as LifecycleStage);
    }
  }

  const lastEventAt = new Map<string, string>();
  const hasAnyEvent = new Set<string>();
  for (const ev of eventsRes.data ?? []) {
    if (!ev.user_id) continue;
    hasAnyEvent.add(ev.user_id);
    const prev = lastEventAt.get(ev.user_id);
    if (!prev || ev.occurred_at > prev) {
      lastEventAt.set(ev.user_id, ev.occurred_at);
    }
  }

  const hadScoreLastWeek = new Set<string>();
  for (const row of scoresRes.data ?? []) {
    if (!row.user_id || !row.score || row.score <= 0) continue;
    if (row.computed_at < scoreWeekAgoCutoff) {
      hadScoreLastWeek.add(row.user_id);
    }
  }

  const latestScore = new Map<string, number>();
  for (const row of scoresRes.data ?? []) {
    if (!row.user_id) continue;
    latestScore.set(row.user_id, row.score ?? 0);
  }
  Array.from(scoreByUser.entries()).forEach(([uid, score]) => {
    latestScore.set(uid, score);
  });

  const updatedAt = new Date().toISOString();
  const stages = new Map<string, LifecycleStage>();
  const rows: {
    workspace_id: string;
    user_id: string;
    stage: LifecycleStage;
    updated_at: string;
  }[] = [];

  for (const userId of Array.from(userIds)) {
    const stage = resolveStage({
      score: latestScore.get(userId) ?? scoreByUser.get(userId) ?? null,
      hasPaidEvent: paidUsers.has(userId),
      currentStage: currentStage.get(userId) ?? null,
      lastEventAt: lastEventAt.get(userId) ?? null,
      hadScoreLastWeek: hadScoreLastWeek.has(userId),
      hasAnyEvent: hasAnyEvent.has(userId),
    });

    stages.set(userId, stage);
    rows.push({
      workspace_id: workspaceId,
      user_id: userId,
      stage,
      updated_at: updatedAt,
    });
  }

  const { error: upsertError } = await supabase.from("stages").upsert(rows, {
    onConflict: "workspace_id,user_id",
  });

  if (upsertError) {
    return { stages, assigned: 0, error: upsertError.message };
  }

  return { stages, assigned: rows.length };
}

/**
 * Assign stages for every user that was just scored, plus any tracked user
 * in the workspace (so churn / going-quiet rules apply to inactive users).
 */
export async function assignStages(
  scoredByWorkspace: Map<string, ScoredUser[]>
): Promise<AssignStagesResult> {
  const supabase = createSupabaseAdminClient();
  let assigned = 0;
  const errors: string[] = [];

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id");

  if (wsError) {
    return { assigned: 0, errors: [`workspaces – ${wsError.message}`] };
  }

  for (const ws of workspaces ?? []) {
    const workspaceId = ws.id as string;
    try {
      const justScored = scoredByWorkspace.get(workspaceId) ?? [];
      const result = await assignStagesForWorkspace(workspaceId, justScored);
      if (result.error) {
        errors.push(`workspace:${workspaceId} – ${result.error}`);
        continue;
      }
      assigned += result.assigned;
    } catch (err) {
      errors.push(`workspace:${workspaceId} – ${String(err)}`);
    }
  }

  return { assigned, errors };
}
