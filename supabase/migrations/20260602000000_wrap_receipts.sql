-- Wrap: expense receipts table
create table if not exists wrap_receipts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  vendor      text,
  amount      numeric(10, 2),
  currency    text not null default 'USD',
  date        date,
  category    text check (category in ('food','travel','accommodation','equipment','other')),
  description text,
  trip_name   text,
  image_url   text,
  created_at  timestamptz not null default now()
);

alter table wrap_receipts enable row level security;

create policy "Users manage own wrap receipts"
  on wrap_receipts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket for receipt images
insert into storage.buckets (id, name, public)
values ('wrap-receipts', 'wrap-receipts', true)
on conflict (id) do nothing;

create policy "Authenticated users upload wrap receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'wrap-receipts' and (storage.foldername(name))[1] = 'wrap');

create policy "Public read wrap receipts"
  on storage.objects for select
  using (bucket_id = 'wrap-receipts');

create policy "Users delete own wrap receipts"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'wrap-receipts');
