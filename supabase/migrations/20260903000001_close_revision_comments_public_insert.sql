-- Two overlapping policies ("Anyone can post revision comments" and
-- "Public can insert revision comments") allowed ANY request — no token,
-- no login — to insert a row into revision_comments for any revision_id,
-- with zero scoping. The only legitimate public path is
-- app/api/review/[token]/route.ts, which already validates the review
-- token server-side and writes with the service role key (bypassing RLS
-- entirely) — so these policies were never actually needed for the app to
-- work, only an unused, unscoped bypass sitting next to the real check.
--
-- The only other caller (createRevisionComment in lib/supabase/queries.ts)
-- runs from the authenticated app shell and is already covered by the
-- existing "Workspace members can manage revision comments" ALL policy.
drop policy if exists "Anyone can post revision comments" on public.revision_comments;
drop policy if exists "Public can insert revision comments" on public.revision_comments;
