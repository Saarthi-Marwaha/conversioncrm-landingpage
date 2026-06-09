-- Migration 006: score tracked widget users by text user_id (not only end_users FK)
--
-- The widget stores events with events.user_id. Engagement scores should upsert
-- one row per (workspace_id, user_id) for the weekly cron.

alter table engagement_scores
  add column if not exists user_id text;

alter table engagement_scores
  alter column end_user_id drop not null;

-- One current score row per tracked user per workspace (cron upserts)
create unique index if not exists engagement_scores_workspace_user_id
  on engagement_scores (workspace_id, user_id)
  where user_id is not null;

create index if not exists engagement_scores_workspace_score
  on engagement_scores (workspace_id, score desc);
