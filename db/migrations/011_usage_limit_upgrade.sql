-- Migration 011: usage-limit upgrade emails (queued on limit hit, sent at nightly cron)

-- Extend allowed email trigger
alter table email_logs drop constraint if exists email_logs_trigger_check;
alter table email_logs add constraint email_logs_trigger_check
  check (trigger in (
    'welcome', 'feature_nudge', 'value_demo', 'check_in',
    'upgrade_offer', 'urgency', 'churn_prevention', 'daily_summary',
    'limit_upgrade'
  ));

-- Pending signals: recorded when a user exhausts trial / weekly / monthly / quota allowance
create table if not exists usage_limit_signals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       text not null,
  limit_type    text not null
                  check (limit_type in ('trial', 'weekly', 'monthly', 'quota')),
  event_type    text not null,
  metadata      jsonb not null default '{}',
  hit_at        timestamptz not null default now(),
  email_sent_at timestamptz,
  created_at    timestamptz not null default now()
);

-- One pending signal per user per limit type (until emailed)
create unique index if not exists usage_limit_signals_pending_unique
  on usage_limit_signals (workspace_id, user_id, limit_type)
  where email_sent_at is null;

create index if not exists usage_limit_signals_pending_lookup
  on usage_limit_signals (workspace_id, hit_at)
  where email_sent_at is null;

alter table usage_limit_signals enable row level security;

create policy "usage_limit_signals_workspace_owner" on usage_limit_signals
  for all using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );
