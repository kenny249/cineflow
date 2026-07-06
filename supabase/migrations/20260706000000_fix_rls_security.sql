-- Fix Supabase security advisor: two tables had RLS disabled/missing.
-- Both tables are service-role-only; enabling RLS (with no policies)
-- denies all anon/authenticated access while service role bypasses RLS entirely.

-- 1. processed_webhook_events: was explicitly DISABLED, re-enable
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- 2. jarvis_metrics_snapshots: RLS was never set up
ALTER TABLE jarvis_metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- site_settings (created 20260625): verify it's also enabled
-- (already in that migration but defensive re-apply is safe)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
