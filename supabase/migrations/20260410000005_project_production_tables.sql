-- ─── Project Role Permissions ────────────────────────────────────────────────
-- Extends project_members.role with explicit permission levels
-- role: 'admin' | 'team' | 'client' | 'owner'
-- Already exists in project_members table, just documenting the convention:
-- admin  → full access including finance
-- team   → upload, edit, view everything except finance
-- client → view-only restricted scope
-- owner  → same as admin, set on project creator

-- ─── Project Files ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_files (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  tab         TEXT NOT NULL DEFAULT 'docs',  -- 'scripts' | 'docs' | 'locations' | 'other'
  category    TEXT,                           -- user-defined subfolder/category
  name        TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url  TEXT,
  size        BIGINT,
  mime_type   TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ─── Crew ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crew_contacts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL,
  department  TEXT,
  email       TEXT,
  phone       TEXT,
  notes       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ─── Locations ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_locations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  address      TEXT,
  maps_url     TEXT,
  notes        TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  sort_order   INTEGER DEFAULT 0,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ─── Wrap Notes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wrap_notes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  production_day  TEXT NOT NULL,  -- e.g. "Day 1", "2026-04-15"
  content         TEXT NOT NULL DEFAULT '',
  issues          TEXT,
  outstanding     TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ─── Budget / Finance ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_lines (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  budgeted    NUMERIC(12,2) DEFAULT 0,
  actual      NUMERIC(12,2),
  vendor      TEXT,
  notes       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE project_files      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_locations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrap_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines       ENABLE ROW LEVEL SECURITY;

-- project_files: any authenticated user can read/write for now
CREATE POLICY "project_files_select" ON project_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_files_insert" ON project_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "project_files_delete" ON project_files FOR DELETE TO authenticated USING (true);

CREATE POLICY "crew_contacts_select" ON crew_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "crew_contacts_all"    ON crew_contacts FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "project_locations_select" ON project_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_locations_all"    ON project_locations FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "wrap_notes_select" ON wrap_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "wrap_notes_all"    ON wrap_notes FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- budget_lines: restrict to admin/owner via project_members role check
CREATE POLICY "budget_lines_admin_only" ON budget_lines FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = budget_lines.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = budget_lines.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- ─── Storage bucket for project files ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-files',
  'project-files',
  false,
  5368709120,  -- 5 GB limit per file
  NULL         -- allow all mime types
)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

-- Storage RLS: authenticated users can upload/download
CREATE POLICY "project_files_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');

CREATE POLICY "project_files_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "project_files_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files');
