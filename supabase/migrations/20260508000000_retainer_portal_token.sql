-- Add portal_token to retainers for shareable client portal links
alter table retainers
  add column if not exists portal_token uuid unique;
