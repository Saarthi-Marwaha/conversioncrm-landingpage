-- Migration 008: per-user lifecycle stage (widget user_id model)
--
-- Updated nightly after engagement scoring. One current stage per
-- (workspace_id, user_id).

create table if not exists stages (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       text not null,
  stage         text not null
                  check (stage in (
                    'signup','onboarding','active','going_quiet',
                    'conversion_ready','paid','churned'
                  )),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists stages_workspace_stage
  on stages (workspace_id, stage);
