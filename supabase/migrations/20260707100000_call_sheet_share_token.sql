-- Add share_token for public read-only call sheet links
alter table call_sheets
  add column if not exists share_token uuid default gen_random_uuid() unique;

-- Backfill existing rows that got a NULL token
update call_sheets set share_token = gen_random_uuid() where share_token is null;

-- Make it not-null going forward
alter table call_sheets
  alter column share_token set not null;
