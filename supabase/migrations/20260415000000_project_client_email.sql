-- Add client_email to projects so client contact info is stored at the project level
-- and can pre-fill the client portal creation form.

alter table projects
  add column if not exists client_email text;
