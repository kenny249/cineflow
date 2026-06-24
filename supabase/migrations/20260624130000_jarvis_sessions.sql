-- Jarvis session transcripts — saved when each session ends
create table if not exists jarvis_sessions (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references auth.users(id) on delete cascade,
  messages      jsonb not null default '[]',
  command_count int not null default 0,
  duration_ms   int,
  created_at    timestamptz not null default now()
);

alter table jarvis_sessions enable row level security;

create policy "Admin reads own sessions"
  on jarvis_sessions for select
  using (auth.uid() = admin_id);

create policy "Admin writes own sessions"
  on jarvis_sessions for all
  using (auth.uid() = admin_id);
