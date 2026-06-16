-- ─── Phase 2 Enhancements ─────────────────────────────────────────────────────

-- 1. Equipment: expand category CHECK to include production departments
ALTER TABLE project_equipment DROP CONSTRAINT IF EXISTS project_equipment_category_check;
ALTER TABLE project_equipment ADD CONSTRAINT project_equipment_category_check
  CHECK (category IN (
    'camera', 'audio', 'lighting', 'support', 'other',
    'grip', 'electric', 'wardrobe', 'hair_makeup', 'vehicles', 'catering'
  ));

-- 2. Invoices: support uploaded external PDFs / contracts
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url    TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source      TEXT    NOT NULL DEFAULT 'built';

-- 3. Projects: storyboard PDF upload
ALTER TABLE projects ADD COLUMN IF NOT EXISTS storyboard_pdf_url  TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS storyboard_pdf_name TEXT;

-- 4. Profiles: custom quote templates + per-user calendar event colors
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quote_templates  JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendar_colors  JSONB NOT NULL DEFAULT '{}'::jsonb;
