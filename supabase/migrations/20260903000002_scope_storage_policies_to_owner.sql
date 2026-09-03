-- Every storage bucket's policies checked only bucket_id — none of them
-- checked WHO was asking or WHOSE file it was. Confirmed live: a real,
-- unrelated authenticated user could download AND delete another
-- customer's file in project-files with nothing more than the public anon
-- key and a project id. The same shape of gap existed on contracts,
-- shot-images, storyboard-images (which didn't even require login),
-- brand-assets, and an abandoned wrap-receipts feature.
--
-- This does not touch each bucket's `public` read-via-URL behavior (a
-- deliberate, existing trade-off for buckets whose files are meant to be
-- viewable via a direct link — contract PDFs for signing, storyboard
-- frames for share links, etc.) — it closes the much more dangerous gap:
-- arbitrary cross-user access and deletion through the authenticated SDK,
-- which never should have depended on nothing but bucket_id.

-- Reusable check for path-prefixed-by-project-id buckets: is `segment` a
-- project the current user owns or is a member of? Guards the uuid cast so
-- a non-project segment (e.g. "_demo") is simply not a match, never an error.
create or replace function storage_path_project_accessible(segment text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  begin
    pid := segment::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return exists (select 1 from projects p where p.id = pid and p.created_by = auth.uid())
      or exists (select 1 from project_members pm where pm.project_id = pid and pm.user_id = auth.uid());
end;
$$;

-- ── project-files ── paths are `${project_id}/...` everywhere except the
-- shared `_demo/*.jpg` images (written via service role, needs to stay
-- publicly readable for demo accounts).
drop policy if exists "project_files_storage_select" on storage.objects;
drop policy if exists "project_files_storage_insert" on storage.objects;
drop policy if exists "project_files_storage_delete" on storage.objects;

create policy "project_files_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-files'
  and ((storage.foldername(name))[1] = '_demo' or storage_path_project_accessible((storage.foldername(name))[1]))
);

create policy "project_files_storage_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'project-files'
  and storage_path_project_accessible((storage.foldername(name))[1])
  and workspace_has_active_plan()
);

create policy "project_files_storage_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'project-files' and storage_path_project_accessible((storage.foldername(name))[1]));

-- ── storyboard-images ── paths are `storyboard/${project_id}/${frame_id}.ext`.
-- Previously a single ALL policy open to the `public` role — no login, no
-- ownership, nothing.
drop policy if exists "storyboard images all" on storage.objects;

create policy "storyboard_images_select" on storage.objects
for select to authenticated
using (bucket_id = 'storyboard-images' and storage_path_project_accessible((storage.foldername(name))[2]));

create policy "storyboard_images_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'storyboard-images' and storage_path_project_accessible((storage.foldername(name))[2]));

create policy "storyboard_images_update" on storage.objects
for update to authenticated
using (bucket_id = 'storyboard-images' and storage_path_project_accessible((storage.foldername(name))[2]));

create policy "storyboard_images_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'storyboard-images' and storage_path_project_accessible((storage.foldername(name))[2]));

-- ── contracts ── paths are `${user_id}/${timestamp}.ext`.
drop policy if exists "Anyone can view contract files" on storage.objects;
drop policy if exists "Auth users can upload contract files" on storage.objects;
drop policy if exists "Users can delete their contract files" on storage.objects;

create policy "contracts_storage_select" on storage.objects
for select to authenticated
using (bucket_id = 'contracts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "contracts_storage_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'contracts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "contracts_storage_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'contracts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── shot-images ── paths are `${user_id}/${timestamp}.ext`.
drop policy if exists "Anyone can view shot images" on storage.objects;
drop policy if exists "Auth users can upload shot images" on storage.objects;
drop policy if exists "Users can delete their shot images" on storage.objects;

create policy "shot_images_storage_select" on storage.objects
for select to authenticated
using (bucket_id = 'shot-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "shot_images_storage_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'shot-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "shot_images_storage_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'shot-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── brand-assets ── admin-only feature; the real app only ever writes to
-- this bucket via app/api/admin/brand (service role, bypasses RLS
-- entirely). There is no legitimate authenticated-but-non-admin writer, so
-- there's no policy to scope — just remove the open ones. Public read stays
-- (branding assets need to render unauthenticated, e.g. in emails).
drop policy if exists "brand_assets_insert" on storage.objects;
drop policy if exists "brand_assets_delete" on storage.objects;

-- ── wrap-receipts ── an abandoned feature (table + bucket exist, RLS on
-- the table itself was already correctly owner-scoped, but the storage
-- policies were not — no application code references this today, but the
-- table has 2 real leftover rows from early testing). Tightened rather
-- than removed, since dropping tables/data isn't a call to make silently.
-- Real path convention (from the existing rows) is `wrap/${user_id}/...`.
drop policy if exists "Public read wrap receipts" on storage.objects;
drop policy if exists "Authenticated users upload wrap receipts" on storage.objects;
drop policy if exists "Users delete own wrap receipts" on storage.objects;

create policy "wrap_receipts_storage_select" on storage.objects
for select to authenticated
using (bucket_id = 'wrap-receipts' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "wrap_receipts_storage_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'wrap-receipts' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "wrap_receipts_storage_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'wrap-receipts' and (storage.foldername(name))[2] = auth.uid()::text);

-- Nothing in the live app reads from this bucket today, so there's no
-- public-URL feature to preserve — flip it private too, closing even the
-- direct-link viewing path for the 2 leftover test files.
update storage.buckets set public = false where id = 'wrap-receipts';
