-- Crew profiles: private crew book + opt-in public discovery network
create table if not exists crew_profiles (
  id              uuid primary key default gen_random_uuid(),
  added_by        uuid references auth.users(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete set null,  -- filled when they claim their profile
  name            text not null,
  slug            text unique,                     -- public URL: /crew/[slug]
  photo_url       text,
  primary_role    text not null default 'Other',
  roles           text[] not null default '{}',    -- all roles they fill
  city            text,
  state           text,
  country         text not null default 'US',
  skills          text[] not null default '{}',    -- e.g. ["RED Operator","Drone Certified"]
  gear            text[] not null default '{}',    -- e.g. ["DJI Inspire 3","ARRI Alexa"]
  day_rate_min    int,
  day_rate_max    int,
  reel_url        text,
  instagram       text,
  website         text,
  email           text,
  phone           text,
  bio             text,
  notes           text,                            -- private notes, only visible to added_by
  rating          int check (rating between 1 and 5),
  availability    text not null default 'available' check (availability in ('available','booked','unavailable')),
  available_from  date,                            -- if booked, available again from
  is_public       boolean not null default false,  -- opted into public search
  is_claimed      boolean not null default false,  -- has a real CineFlow account
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at trigger
create or replace function update_crew_profiles_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger crew_profiles_updated_at
  before update on crew_profiles
  for each row execute function update_crew_profiles_updated_at();

-- RLS
alter table crew_profiles enable row level security;

-- Owner: full access to profiles they added
create policy "crew_owner_all" on crew_profiles
  for all using (added_by = auth.uid());

-- Claimed user: can update their own public profile
create policy "crew_claimed_update" on crew_profiles
  for update using (user_id = auth.uid());

-- Anyone (including anon) can read public profiles
create policy "crew_public_read" on crew_profiles
  for select using (is_public = true);

-- Index for discovery search
create index crew_profiles_primary_role_idx on crew_profiles (primary_role);
create index crew_profiles_city_idx on crew_profiles (city);
create index crew_profiles_is_public_idx on crew_profiles (is_public) where is_public = true;
