-- Jarvis persistent memory — key/value store per admin user
create table if not exists jarvis_memory (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  value       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(admin_id, key)
);

alter table jarvis_memory enable row level security;

create policy "Admin reads own memory"
  on jarvis_memory for select
  using (auth.uid() = admin_id);

create policy "Admin writes own memory"
  on jarvis_memory for all
  using (auth.uid() = admin_id);
