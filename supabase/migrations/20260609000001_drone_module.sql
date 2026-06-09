-- ─── Drone Module ───────────────────────────────────────────────────────────

-- Equipment (user's drones)
CREATE TABLE IF NOT EXISTS drone_equipment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  make            TEXT NOT NULL,
  model           TEXT NOT NULL,
  nickname        TEXT,
  serial_number   TEXT,
  faa_registration TEXT,
  purchase_date   DATE,
  status          TEXT NOT NULL DEFAULT 'active', -- active | in_repair | retired
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drone_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own drones" ON drone_equipment FOR ALL USING (auth.uid() = user_id);

-- Batteries
CREATE TABLE IF NOT EXISTS drone_batteries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  drone_id      UUID REFERENCES drone_equipment(id) ON DELETE SET NULL,
  label         TEXT NOT NULL,
  serial_number TEXT,
  purchase_date DATE,
  cycle_count   INTEGER NOT NULL DEFAULT 0,
  capacity_mah  INTEGER,
  status        TEXT NOT NULL DEFAULT 'active', -- active | retired
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drone_batteries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own batteries" ON drone_batteries FOR ALL USING (auth.uid() = user_id);

-- Flight logs
CREATE TABLE IF NOT EXISTS drone_flight_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  drone_id            UUID REFERENCES drone_equipment(id) ON DELETE SET NULL,
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  flight_date         DATE NOT NULL,
  location            TEXT NOT NULL,
  duration_minutes    INTEGER NOT NULL,
  max_altitude_ft     INTEGER,
  purpose             TEXT,
  weather_conditions  TEXT,
  wind_speed_mph      INTEGER,
  visibility_miles    INTEGER,
  temperature_f       INTEGER,
  preflight_completed BOOLEAN NOT NULL DEFAULT FALSE,
  preflight_items     JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drone_flight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own flights" ON drone_flight_logs FOR ALL USING (auth.uid() = user_id);

-- Flight ↔ battery junction (auto-increments cycle counts via app logic)
CREATE TABLE IF NOT EXISTS drone_flight_batteries (
  flight_id  UUID REFERENCES drone_flight_logs(id) ON DELETE CASCADE NOT NULL,
  battery_id UUID REFERENCES drone_batteries(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (flight_id, battery_id)
);

ALTER TABLE drone_flight_batteries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own flight batteries" ON drone_flight_batteries FOR ALL USING (
  EXISTS (
    SELECT 1 FROM drone_flight_logs WHERE id = flight_id AND user_id = auth.uid()
  )
);

-- Maintenance logs
CREATE TABLE IF NOT EXISTS drone_maintenance_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  drone_id              UUID REFERENCES drone_equipment(id) ON DELETE CASCADE NOT NULL,
  maintenance_date      DATE NOT NULL,
  maintenance_type      TEXT NOT NULL,
  description           TEXT,
  cost_cents            INTEGER,
  next_maintenance_date DATE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drone_maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own maintenance" ON drone_maintenance_logs FOR ALL USING (auth.uid() = user_id);

-- Part 107 columns on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS part107_number     TEXT,
  ADD COLUMN IF NOT EXISTS part107_expires_at DATE;
