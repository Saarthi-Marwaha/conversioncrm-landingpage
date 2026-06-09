-- Migration 004: per-workspace website URL + per-event origin tracking
--
-- website_url on workspaces lets the owner configure which site the widget
-- is installed on.  The dashboard then filters events by matching origin so
-- you only see events from YOUR site, not test-harness or localhost noise.
--
-- origin on events is the value of the HTTP Origin (or Referer host) header
-- captured server-side when the widget POSTs an event.

alter table workspaces
  add column if not exists website_url text;

alter table events
  add column if not exists origin text;
