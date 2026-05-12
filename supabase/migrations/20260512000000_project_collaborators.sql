-- ── Project collaborators ────────────────────────────────────────────────────
-- External crew/clients invited to a specific project. Separate from the
-- workspace team_members system — collaborators only see their project.

create table if not exists project_collaborators (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  invited_by   uuid not null references auth.users(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null, -- null until accepted
  email        text not null,
  name         text not null,
  status       text not null default 'pending' check (status in ('pending', 'active')),
  created_at   timestamptz not null default now()
);

create unique index if not exists project_collaborators_project_email
  on project_collaborators (project_id, email);

-- ── Project messages ─────────────────────────────────────────────────────────
-- Real-time chat per project. Visible to agency team + project collaborators.

create table if not exists project_messages (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  author_id    uuid not null references auth.users(id) on delete cascade,
  author_name  text not null,
  content      text not null check (char_length(content) > 0 and char_length(content) <= 4000),
  created_at   timestamptz not null default now()
);

create index if not exists project_messages_project_created
  on project_messages (project_id, created_at desc);

-- ── Profiles: collaborator flag ───────────────────────────────────────────────
alter table profiles
  add column if not exists is_collaborator boolean not null default false;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table project_collaborators enable row level security;
alter table project_messages enable row level security;

-- project_collaborators: agency owner sees all for their projects
create policy "agency can manage collaborators"
  on project_collaborators for all
  using (
    invited_by = auth.uid()
    or invited_by in (
      select id from auth.users where id in (
        select workspace_id from profiles where id = auth.uid()
      )
    )
  );

-- project_collaborators: collaborators see their own rows
create policy "collaborators see own rows"
  on project_collaborators for select
  using (user_id = auth.uid());

-- project_messages: agency sees messages for projects they own
create policy "agency sees project messages"
  on project_messages for all
  using (
    project_id in (
      select id from projects where created_by = get_workspace_owner_id()
    )
  );

-- project_messages: collaborators see messages for their project
create policy "collaborators see their project messages"
  on project_messages for select
  using (
    project_id in (
      select project_id from project_collaborators
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "collaborators can post messages"
  on project_messages for insert
  with check (
    author_id = auth.uid()
    and project_id in (
      select project_id from project_collaborators
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Enable realtime for project_messages
alter publication supabase_realtime add table project_messages;
