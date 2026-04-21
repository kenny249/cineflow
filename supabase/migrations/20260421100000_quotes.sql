-- ── Brand color on profiles ─────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_color TEXT;

-- ── Quotes table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID         REFERENCES projects(id) ON DELETE SET NULL,
  quote_number         TEXT         NOT NULL,
  client_name          TEXT,
  client_email         TEXT,
  description          TEXT,

  status               TEXT         NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft','sent','viewed','accepted','declined','expired')),
  quote_type           TEXT         NOT NULL DEFAULT 'project'
                                    CHECK (quote_type IN ('project','retainer')),

  -- Pricing
  amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate             NUMERIC(5,2)  DEFAULT 0,
  discount             NUMERIC(12,2) DEFAULT 0,
  currency             TEXT          DEFAULT 'USD',

  -- Content
  line_items           JSONB         DEFAULT '[]',
  packages             JSONB         DEFAULT '[]',   -- QuotePackage[]
  scope_of_work        TEXT,
  payment_terms        TEXT          DEFAULT 'net30',
  notes                TEXT,

  -- Retainer-specific
  monthly_rate         NUMERIC(12,2),
  retainer_months      INT,
  retainer_deliverables JSONB,                      -- RetainerTemplateItem[]

  -- Lifecycle dates
  valid_until          DATE,
  sent_at              TIMESTAMPTZ,
  viewed_at            TIMESTAMPTZ,
  accepted_at          TIMESTAMPTZ,
  declined_at          TIMESTAMPTZ,
  accepted_name        TEXT,
  accepted_email       TEXT,

  -- Public sharing
  token                TEXT          UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active            BOOLEAN       NOT NULL DEFAULT TRUE,

  -- Branding snapshot (captured at send time so old quotes stay consistent)
  brand_logo_url       TEXT,
  brand_name           TEXT,
  brand_color          TEXT,

  -- Conversion tracking
  converted_project_id UUID          REFERENCES projects(id) ON DELETE SET NULL,
  converted_invoice_id UUID          REFERENCES invoices(id) ON DELETE SET NULL,

  created_by           UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Authenticated owner access
CREATE POLICY "Users can manage their own quotes" ON quotes
  FOR ALL
  USING  (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Public read — anyone with the token can view the quote page
CREATE POLICY "Public can view active quotes" ON quotes
  FOR SELECT
  USING (is_active = TRUE);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE TRIGGER handle_updated_at_quotes
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- ── Index for fast token lookup ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS quotes_token_idx ON quotes (token);
CREATE INDEX IF NOT EXISTS quotes_created_by_idx ON quotes (created_by);
