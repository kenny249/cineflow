-- boards_public_share (and the matching policies on board_cards and
-- board_columns) checked "does this board have a share_token at all,"
-- never that the caller's token actually matched it. Since the anon key
-- is public, anyone could ask Supabase directly for every board that has
-- ever been shared platform-wide — no token needed. Same shape of gap as
-- the quotes leak fixed earlier today.
--
-- The public share page now fetches via app/api/boards/public (service
-- role, does the real token match server-side), so these policies are no
-- longer needed for the app to function — dropping them removes the
-- public read path from the database entirely.
drop policy if exists "boards_public_share" on public.boards;
drop policy if exists "board_cards_public_share" on public.board_cards;
drop policy if exists "board_columns_public_share" on public.board_columns;
