-- Fix schema mismatches between TypeScript types and the database tables

-- 1. Add missing calendar event type values
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'delivery';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'other';

-- 2. Add missing columns to shot_list_items to match TypeScript types
ALTER TABLE shot_list_items
  ADD COLUMN IF NOT EXISTS shot_type TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS camera_movement TEXT DEFAULT 'static',
  ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lens TEXT,
  ADD COLUMN IF NOT EXISTS scene TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;

-- 3. Sync is_complete from existing status column data
UPDATE shot_list_items SET is_complete = true WHERE status = 'completed';

-- 4. Add category column to shot_lists
ALTER TABLE shot_lists ADD COLUMN IF NOT EXISTS category TEXT;

-- 5. Add role column to profiles (if missing)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'filmmaker';
