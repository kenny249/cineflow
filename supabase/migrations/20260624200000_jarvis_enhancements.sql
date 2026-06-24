-- ── Jarvis session summaries — auto-generated cross-session learning ─────────
create table if not exists jarvis_session_summaries (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references auth.users(id) on delete cascade,
  summary       text not null,
  command_count int,
  created_at    timestamptz not null default now()
);

alter table jarvis_session_summaries enable row level security;

create policy "Admin reads own summaries"
  on jarvis_session_summaries for select
  using (auth.uid() = admin_id);

create policy "Admin manages own summaries"
  on jarvis_session_summaries for all
  using (auth.uid() = admin_id);

-- ── Jarvis settings — personality dials + voice speed per admin ───────────────
create table if not exists jarvis_settings (
  admin_id    uuid primary key references auth.users(id) on delete cascade,
  personality jsonb not null default '{"humor":50,"energy":50,"formality":50}',
  voice_speed numeric(4,2) not null default 1.0,
  updated_at  timestamptz not null default now()
);

alter table jarvis_settings enable row level security;

create policy "Admin manages own settings"
  on jarvis_settings for all
  using (auth.uid() = admin_id);

-- ── Jarvis metrics snapshots — daily stats saved by cron for trend analysis ───
create table if not exists jarvis_metrics_snapshots (
  id            uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  data          jsonb not null,
  created_at    timestamptz not null default now()
);
-- Service role only — cron writes, Jarvis route reads via admin client
