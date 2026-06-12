/**
 * Nightly engagement scoring — extracted from the cron route so stage
 * assignment can run immediately after without duplicating logic.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { computeWeeklyEngagementScore, type ScoringEvent } from "@/lib/scoring";
import { daysAgo } from "@/lib/utils";

export type ScoredUser = {
  workspace_id: string;
  user_id: string;
  score: number;
};

export type RunScoringResult = {
  scored: number;
  errors: string[];
  /** Users successfully scored this run, grouped by workspace. */
  scoredByWorkspace: Map<string, ScoredUser[]>;
};

type WorkspaceRow = {
  id: string;
  key_feature_name: string | null;
  key_feature_event: string | null;
};

type EventRow = {
  user_id: string | null;
  event_type: string;
  page: string | null;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

export async function runScoring(): Promise<RunScoringResult> {
  const supabase = createSupabaseAdminClient();
  const since = daysAgo(7);

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id, key_feature_name, key_feature_event");

  if (wsError) {
    throw new Error(`Failed to fetch workspaces: ${wsError.message}`);
  }

  let scored = 0;
  const errors: string[] = [];
  const scoredByWorkspace = new Map<string, ScoredUser[]>();

  for (const workspace of (workspaces ?? []) as WorkspaceRow[]) {
    const workspaceScored: ScoredUser[] = [];

    const { data: events, error: evError } = await supabase
      .from("events")
      .select("user_id, event_type, page, properties, occurred_at")
      .eq("workspace_id", workspace.id)
      .gte("occurred_at", since)
      .not("user_id", "is", null);

    if (evError) {
      errors.push(`workspace:${workspace.id} – ${evError.message}`);
      continue;
    }

    const byUser = new Map<string, ScoringEvent[]>();
    for (const ev of (events ?? []) as EventRow[]) {
      if (!ev.user_id) continue;
      const list = byUser.get(ev.user_id) ?? [];
      list.push({
        event_type: ev.event_type,
        page: ev.page,
        properties: ev.properties,
        occurred_at: ev.occurred_at,
      });
      byUser.set(ev.user_id, list);
    }

    const computedAt = new Date().toISOString();

    for (const [userId, userEvents] of Array.from(byUser.entries())) {
      try {
        const { score, breakdown } = computeWeeklyEngagementScore(
          userEvents,
          workspace.key_feature_name,
          workspace.key_feature_event
        );

        const { error: upsertError } = await supabase
          .from("engagement_scores")
          .upsert(
            {
              workspace_id: workspace.id,
              user_id: userId,
              end_user_id: null,
              score,
              score_breakdown: breakdown,
              computed_at: computedAt,
            },
            { onConflict: "workspace_id,user_id" }
          );

        if (upsertError) {
          errors.push(`user:${userId} – ${upsertError.message}`);
          continue;
        }

        workspaceScored.push({
          workspace_id: workspace.id,
          user_id: userId,
          score,
        });
        scored++;
      } catch (err) {
        errors.push(`user:${userId} – ${String(err)}`);
      }
    }

    if (workspaceScored.length > 0) {
      scoredByWorkspace.set(workspace.id, workspaceScored);
    }
  }

  return { scored, errors, scoredByWorkspace };
}
