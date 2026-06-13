-- Add free-form canvas positioning to board cards
ALTER TABLE board_cards
  ADD COLUMN IF NOT EXISTS x FLOAT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS y FLOAT NOT NULL DEFAULT 100;

-- Cards can now live outside columns (standalone on the canvas)
ALTER TABLE board_cards
  ALTER COLUMN column_id DROP NOT NULL;
