-- Migration 018: per-workspace subscription plan + monthly email quota
--
-- ConversionCRM bills the workspace owner (its own customer) via Razorpay.
-- `plan` is NULL until the owner explicitly chooses one — the app gates the
-- dashboard behind /pricing while it is NULL (no bypass).

alter table workspaces
  add column if not exists plan text
    check (plan in ('free','basic','pro','premium','enterprise')),
  add column if not exists email_quota integer,
  add column if not exists plan_status text not null default 'none'
    check (plan_status in ('active','past_due','cancelled','none')),
  add column if not exists plan_selected_at timestamptz,
  add column if not exists razorpay_customer_id text,
  add column if not exists razorpay_subscription_id text,
  add column if not exists plan_renews_at timestamptz;

-- Fast monthly-usage counts: emails sent per workspace within a window.
create index if not exists email_logs_workspace_status_sent
  on email_logs (workspace_id, status, sent_at desc);

-- The seeded dev/test workspace (migration 003) gets the Free plan so local
-- work isn't perpetually bounced to the pricing gate.
update workspaces
  set plan = 'free',
      email_quota = 1000,
      plan_status = 'active',
      plan_selected_at = now()
  where id = '00000000-0000-0000-0000-000000000001'
    and plan is null;
