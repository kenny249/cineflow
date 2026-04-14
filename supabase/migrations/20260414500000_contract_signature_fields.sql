-- Add signature field placement + sender signing + stamped PDF support to contracts

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS signature_fields   JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sender_name        TEXT,
  ADD COLUMN IF NOT EXISTS sender_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS sender_signed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_pdf_url     TEXT;
