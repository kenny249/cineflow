-- Explicit frame membership for board cards. Previously a card's "belongs
-- to this frame" status was inferred fresh from geometry on every frame
-- drag (whichever cards currently overlapped the frame's bounds), which
-- could re-derive a different answer than what the user actually did —
-- e.g. a card dragged mostly out of a frame could still count as a member
-- if a single corner technically remained inside. Persisting the
-- membership once, when a card is dropped in or out of a frame's bounds,
-- removes that ambiguity and is correct under concurrent multiplayer
-- edits, where each client's local geometry recompute could otherwise
-- disagree.
alter table board_cards
  add column if not exists frame_id uuid references board_cards(id) on delete set null;

create index if not exists board_cards_frame_id_idx on board_cards (frame_id);
