-- ─────────────────────────────────────────────
-- 003 — Widget testing support
--
-- Makes the events table widget-friendly so we can ingest events
-- without a logged-in session or a full end_users record yet.
-- Also seeds a fixed test workspace the widget can target during dev.
-- ─────────────────────────────────────────────

-- Add the lightweight columns the widget sends directly
alter table events add column if not exists user_id text;
alter table events add column if not exists page    text;

-- Relax NOT NULL constraints that required a full end_users join + event_name
alter table events alter column end_user_id drop not null;
alter table events alter column event_name  drop not null;

-- Allow arbitrary event_type strings from ConversionCRM.track(...)
alter table events drop constraint if exists events_event_type_check;

-- Allow seeding a workspace without a real auth user (dev/testing only)
alter table workspaces alter column owner_id drop not null;

-- Seed a fixed test workspace so the widget has a known api_key + workspace_id
insert into workspaces (id, name, api_key, key_feature_name)
values (
  '00000000-0000-0000-0000-000000000001',
  'Test Workspace',
  'ccrm_test_key',
  'export'
)
on conflict (id) do nothing;
