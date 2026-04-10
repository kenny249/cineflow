-- Fix calendar_events RLS to explicitly allow INSERT/UPDATE
DROP POLICY IF EXISTS "Allow all operations on calendar_events for development" ON calendar_events;

CREATE POLICY "Allow all operations on calendar_events for development" ON calendar_events
  FOR ALL USING (true) WITH CHECK (true);
