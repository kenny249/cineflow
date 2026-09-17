-- Live-verified facts (competitor pricing, market size) shown in the admin
-- Company Brief. Populated by app/api/admin/brief/verify (manual "Refresh"
-- button) and the weekly app/api/cron/brief-refresh job — both use Claude's
-- native web_search tool to re-check each value against the live web rather
-- than trusting the hardcoded defaults in lib/brief.config.ts to stay current.
create table if not exists public.brief_data_points (
  key           text primary key,
  label         text not null,
  value_display text not null,
  value_number  numeric,
  source_url    text,
  source_title  text,
  note          text,
  verified_at   timestamptz not null default now()
);

-- No public RLS policies — this table is only ever read/written server-side
-- via the service-role client (admin Brief page + the public share/print
-- views, matching the pattern documented in CLAUDE.md for public/token pages).
alter table public.brief_data_points enable row level security;
