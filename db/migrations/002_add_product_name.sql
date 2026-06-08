-- Add product_name column to workspaces
-- Run after 001_initial_schema.sql

alter table workspaces
  add column if not exists product_name text;
