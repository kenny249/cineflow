-- Call Sheets: persistent editable call sheet data per project
-- Multiple call sheets per project (one per shoot day)

create table if not exists call_sheets (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text not null default 'Call Sheet',
  shoot_date  date,
  data        jsonb not null default '{}',
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table call_sheets enable row level security;

-- Workspace members can manage call sheets on their workspace's projects
create policy "Workspace members can view call sheets"
  on call_sheets for select
  using (
    project_id in (
      select id from projects where created_by = get_workspace_owner_id()
    )
  );

create policy "Workspace members can insert call sheets"
  on call_sheets for insert
  with check (
    project_id in (
      select id from projects where created_by = get_workspace_owner_id()
    )
    and created_by = auth.uid()
  );

create policy "Workspace members can update call sheets"
  on call_sheets for update
  using (
    project_id in (
      select id from projects where created_by = get_workspace_owner_id()
    )
  );

create policy "Workspace owner can delete call sheets"
  on call_sheets for delete
  using (
    project_id in (
      select id from projects where created_by = get_workspace_owner_id()
    )
    and is_workspace_owner()
  );

-- Auto-update updated_at
create or replace function update_call_sheet_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger call_sheets_updated_at
  before update on call_sheets
  for each row execute function update_call_sheet_updated_at();
