-- ============================================================
-- Contracts, Project Tasks, and Shot Image support
-- ============================================================

-- ─── 1. shot_list_items: add image_url ───────────────────────────────────────
ALTER TABLE shot_list_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ─── 2. project_tasks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_tasks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  type        TEXT DEFAULT 'general',
  priority    TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status      TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date    DATE,
  assignee_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own project tasks" ON project_tasks
  FOR ALL USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ─── 3. contracts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'declined', 'voided')),
  recipient_name  TEXT,
  recipient_email TEXT,
  signing_token   UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  sent_at         TIMESTAMPTZ,
  signed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Owners manage their contracts
CREATE POLICY "Users can manage their own contracts" ON contracts
  FOR ALL USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Public read by signing token (signing page fetches via API with service role)
-- No anon select policy needed — signing uses service role key on server

-- ─── 4. contract_signatures ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_signatures (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id     UUID REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  signer_name     TEXT,
  signer_email    TEXT,
  signature_data  TEXT NOT NULL,
  signed_at       TIMESTAMPTZ DEFAULT NOW(),
  ip_address      TEXT
);

ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;

-- Owners can view signatures on their contracts
CREATE POLICY "Owners can view signatures for their contracts" ON contract_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = contract_id AND c.created_by = auth.uid()
    )
  );

-- Anyone can insert a signature (signing is public, validated by token server-side)
CREATE POLICY "Anyone can insert a contract signature" ON contract_signatures
  FOR INSERT WITH CHECK (true);

-- ─── 5. Storage buckets ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('shot-images', 'shot-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO NOTHING;

-- Shot images storage policies
CREATE POLICY "Auth users can upload shot images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shot-images');

CREATE POLICY "Anyone can view shot images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shot-images');

CREATE POLICY "Users can delete their shot images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shot-images');

-- Contract files storage policies
CREATE POLICY "Auth users can upload contract files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Anyone can view contract files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contracts');

CREATE POLICY "Users can delete their contract files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts');
