-- ── Invoices ─────────────────────────────────────────────────────────────────
create table if not exists invoices (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references projects(id) on delete cascade,
  invoice_number text not null,
  client_name    text,
  description    text,
  amount         numeric(12,2) not null default 0,
  status         text not null default 'draft'
                   check (status in ('draft','sent','partial','paid','overdue')),
  amount_paid    numeric(12,2) not null default 0,
  due_date       date,
  paid_date      date,
  notes          text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table invoices enable row level security;

-- All authenticated users can manage invoices for now (beta)
create policy "authenticated can manage invoices"
  on invoices for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Trigger: updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger invoices_updated_at
  before update on invoices
  for each row execute procedure set_updated_at();
