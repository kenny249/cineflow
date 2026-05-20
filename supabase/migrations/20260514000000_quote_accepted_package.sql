-- Store which package the client selected when accepting a multi-package quote
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_package_id TEXT;
