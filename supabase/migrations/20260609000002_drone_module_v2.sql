-- ─── Drone Module v2 — additional professional fields ────────────────────────

-- Equipment: weight class, Remote ID, firmware, insurance
ALTER TABLE drone_equipment
  ADD COLUMN IF NOT EXISTS weight_grams        INTEGER,
  ADD COLUMN IF NOT EXISTS remote_id_serial    TEXT,
  ADD COLUMN IF NOT EXISTS firmware_version    TEXT,
  ADD COLUMN IF NOT EXISTS insurance_policy    TEXT,
  ADD COLUMN IF NOT EXISTS insurance_expires_at DATE;

-- Flight logs: LAANC auth, night flight flag, incident tracking
ALTER TABLE drone_flight_logs
  ADD COLUMN IF NOT EXISTS laanc_auth_code TEXT,
  ADD COLUMN IF NOT EXISTS is_night_flight  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS incident_flag    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS incident_notes   TEXT;

-- Profiles: Part 107 document storage URL
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS part107_document_url TEXT;
