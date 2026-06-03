-- Wrap: trips for grouping receipts + client billing
create table if not exists wrap_trips (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  name                    text not null,
  client_name             text,
  client_email            text,
  notes                   text,
  status                  text not null default 'open'
                            check (status in ('open', 'sent', 'paid')),
  stripe_session_id       text,
  stripe_payment_intent   text,
  paid_at                 timestamptz,
  created_at              timestamptz not null default now()
);

alter table wrap_trips enable row level security;

create policy "Users manage own wrap trips"
  on wrap_trips for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Allow public read for the expense report page (unauthenticated clients)
create policy "Public read wrap trips"
  on wrap_trips for select
  using (true);

-- Add trip reference to receipts
alter table wrap_receipts
  add column if not exists trip_id uuid references wrap_trips(id) on delete set null;

-- Public read for receipts too (needed for the report page)
create policy "Public read wrap receipts"
  on wrap_receipts for select
  using (true);
