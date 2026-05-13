-- Assign calendar events to specific team members
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to ON calendar_events(assigned_to);
