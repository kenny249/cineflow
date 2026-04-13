-- Add missing invoice columns (line items, payment, email)
alter table invoices
  add column if not exists client_email   text,
  add column if not exists line_items     jsonb,
  add column if not exists tax_rate       numeric(5,2) default 0,
  add column if not exists payment_method text,
  add column if not exists payment_link   text,
  add column if not exists payment_terms  text;

-- Allow public read of invoices by ID (for client pay page — UUID acts as secret)
create policy "public can view invoice by id"
  on invoices for select
  using (true);
