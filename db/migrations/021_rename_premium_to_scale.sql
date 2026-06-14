-- Migration 021: tier rename premium → scale
--
-- The plan ladder became Free / Basic / Pro / Scale / Enterprise. Swap the
-- check constraints and migrate any existing 'premium' rows to 'scale'.

alter table workspaces drop constraint if exists workspaces_plan_check;
alter table workspaces drop constraint if exists workspaces_pending_plan_check;

update workspaces set plan = 'scale' where plan = 'premium';
update workspaces set pending_plan = 'scale' where pending_plan = 'premium';

alter table workspaces add constraint workspaces_plan_check
  check (plan in ('free','basic','pro','scale','enterprise'));
alter table workspaces add constraint workspaces_pending_plan_check
  check (pending_plan in ('free','basic','pro','scale','enterprise'));
