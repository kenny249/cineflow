-- Add meeting_link column to calendar_events
-- Stores Google Meet, Zoom, or any video call URL for online events.

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS meeting_link text;
