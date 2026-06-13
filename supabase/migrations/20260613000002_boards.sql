-- Boards: visual creative canvas per-project or standalone

CREATE TABLE IF NOT EXISTS boards (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id   UUID        REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL DEFAULT 'Board',
  share_token  TEXT        UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_columns (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'Untitled',
  position   FLOAT       NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_cards (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID        NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id  UUID        NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'note',
  content    JSONB       NOT NULL DEFAULT '{}',
  position   FLOAT       NOT NULL DEFAULT 0,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE boards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_cards   ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "boards_owner"        ON boards        FOR ALL USING (workspace_id = auth.uid());
CREATE POLICY "board_columns_owner" ON board_columns FOR ALL USING (
  board_id IN (SELECT id FROM boards WHERE workspace_id = auth.uid())
);
CREATE POLICY "board_cards_owner"   ON board_cards   FOR ALL USING (
  board_id IN (SELECT id FROM boards WHERE workspace_id = auth.uid())
);

-- Public read via share token
CREATE POLICY "boards_public_share"        ON boards        FOR SELECT USING (share_token IS NOT NULL);
CREATE POLICY "board_columns_public_share" ON board_columns FOR SELECT USING (
  board_id IN (SELECT id FROM boards WHERE share_token IS NOT NULL)
);
CREATE POLICY "board_cards_public_share"   ON board_cards   FOR SELECT USING (
  board_id IN (SELECT id FROM boards WHERE share_token IS NOT NULL)
);
