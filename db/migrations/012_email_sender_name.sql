-- Migration 012: per-workspace display name on outgoing emails (From header)

alter table workspaces
  add column if not exists email_sender_name text;

comment on column workspaces.email_sender_name is
  'Display name on automated emails From header, e.g. Acme Team';
