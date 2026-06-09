-- Fix upsert: partial unique INDEX is not valid for ON CONFLICT (workspace_id, user_id).
-- Replace with a proper UNIQUE constraint so cron + live sync can upsert.

drop index if exists engagement_scores_workspace_user_id;

alter table engagement_scores
  drop constraint if exists engagement_scores_workspace_user_id_key;

alter table engagement_scores
  add constraint engagement_scores_workspace_user_id_key
  unique (workspace_id, user_id);
