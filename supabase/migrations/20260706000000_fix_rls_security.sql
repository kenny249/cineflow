-- Fix Supabase security advisor: four tables had RLS disabled or missing.
-- All four are service-role-only; enabling RLS (with no anon policies)
-- denies direct anon/authenticated access while service role bypasses RLS entirely.

-- 1. invite_links: no RLS since creation (May 2026)
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- 2. invite_link_uses: no RLS since creation (May 2026)
ALTER TABLE invite_link_uses ENABLE ROW LEVEL SECURITY;

-- 3. processed_webhook_events: was explicitly DISABLED
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- 4. jarvis_metrics_snapshots: RLS never set up (June 2026)
ALTER TABLE jarvis_metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- 5. site_settings: defensive re-apply (migration 20260625 may not have run yet)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
