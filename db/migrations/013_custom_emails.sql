-- Migration 013: hand-composed emails sent from the dashboard composer

-- Allow the 'custom' trigger on email logs
alter table email_logs drop constraint if exists email_logs_trigger_check;
alter table email_logs add constraint email_logs_trigger_check
  check (trigger in (
    'welcome', 'feature_nudge', 'value_demo', 'check_in',
    'upgrade_offer', 'urgency', 'churn_prevention', 'daily_summary',
    'limit_upgrade', 'custom'
  ));
