-- Track last automated email batch per workspace (throttle live-dashboard runs)
alter table workspaces
  add column if not exists emails_last_run_at timestamptz;
