-- Add 'delivered' and 'cancelled' to project_status enum.
-- The app uses these values but they were never added to the DB enum,
-- causing every attempt to save status='delivered' to fail with a type error.
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'cancelled';
