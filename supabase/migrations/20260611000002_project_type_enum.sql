-- ─── Extend project_type enum with new production types ───────────────────────
-- ADD VALUE is non-transactional in Postgres so each must be its own statement.

ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'music_video';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'short_film';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'feature_film';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'corporate';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'wedding';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'live_event';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'social_content';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'podcast';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'reality_tv';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'editorial';
ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'custom';
