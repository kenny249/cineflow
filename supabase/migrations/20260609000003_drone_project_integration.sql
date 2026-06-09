-- ─── Drone ↔ Project Integration ─────────────────────────────────────────────
-- Links a specific drone to a shot and/or a crew call so the call sheet
-- knows which aircraft is flying and the shot list can filter drone shots.

ALTER TABLE shot_list_items
  ADD COLUMN IF NOT EXISTS drone_id UUID REFERENCES drone_equipment(id) ON DELETE SET NULL;

ALTER TABLE shoot_day_crew_calls
  ADD COLUMN IF NOT EXISTS drone_id UUID REFERENCES drone_equipment(id) ON DELETE SET NULL;

-- Helpful indexes for filtering drone shots / calls
CREATE INDEX IF NOT EXISTS idx_shot_list_items_drone_id
  ON shot_list_items(drone_id) WHERE drone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shoot_day_crew_calls_drone_id
  ON shoot_day_crew_calls(drone_id) WHERE drone_id IS NOT NULL;
