-- SECURITY: review_tokens had two dangerously broad policies:
--   1. "Anyone can view active review tokens" (SELECT, is_active = true) — any
--      authenticated user could dump every user's portals + client emails.
--   2. "Authenticated can manage review tokens" (ALL, USING true, TO public) —
--      anyone (incl. anonymous) could update/delete any token.
--
-- Public access to the portal is now served exclusively through service-role
-- API routes (/api/review/[token], its /deliverables sub-route, the page
-- metadata, /api/studio-branding, /api/notify), which validate the token and
-- only touch rows scoped to that token's project. So RLS no longer needs to
-- expose anything to anon or to non-owner authenticated users.
--
-- What remains: "Workspace members can manage review tokens", scoped to
-- projects owned by the caller's workspace (get_workspace_owner_id() falls back
-- to auth.uid() for solo users, so owners keep full access to their own tokens).

DROP POLICY IF EXISTS "Anyone can view active review tokens" ON review_tokens;
DROP POLICY IF EXISTS "Authenticated can manage review tokens" ON review_tokens;
