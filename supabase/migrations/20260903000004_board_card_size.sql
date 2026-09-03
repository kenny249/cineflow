-- Board notes had no way to be resized — every card rendered at the same
-- fixed width, and note text was clamped to a fixed number of lines
-- regardless of how much the user actually wrote. Nullable so existing
-- cards keep rendering at today's default size until explicitly resized.
alter table board_cards add column if not exists width double precision;
alter table board_cards add column if not exists height double precision;
