-- Migration 014: per-workspace SMTP delivery (bring-your-own email server)

alter table workspaces
  add column if not exists email_provider text not null default 'resend',
  add column if not exists smtp_host text,
  add column if not exists smtp_port int,
  add column if not exists smtp_user text,
  add column if not exists smtp_pass text,
  add column if not exists smtp_secure boolean not null default true,
  add column if not exists smtp_from_email text;

alter table workspaces drop constraint if exists workspaces_email_provider_check;
alter table workspaces add constraint workspaces_email_provider_check
  check (email_provider in ('resend', 'smtp'));

comment on column workspaces.email_provider is
  'resend = platform default sender, smtp = customer''s own SMTP server';
