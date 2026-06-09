-- Migration 005: capture the email a user identified/signed up with.
-- Stored per-event so we can attribute the latest known email to each user
-- on the dashboard. Visitors who never identify keep this null (empty cell).

alter table events
  add column if not exists email text;
