-- Retainer level: master delivery folder + contract end date
ALTER TABLE retainers ADD COLUMN IF NOT EXISTS delivery_folder_url TEXT;
ALTER TABLE retainers ADD COLUMN IF NOT EXISTS end_date DATE;

-- Month level: delivery folder, client approval, payment
ALTER TABLE retainer_months ADD COLUMN IF NOT EXISTS delivery_url TEXT;
ALTER TABLE retainer_months ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE retainer_months ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;

-- Deliverable level: revision tracking
ALTER TABLE retainer_deliverables ADD COLUMN IF NOT EXISTS revision_notes TEXT;
ALTER TABLE retainer_deliverables ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;
ALTER TABLE retainer_deliverables ADD COLUMN IF NOT EXISTS revision_status TEXT DEFAULT 'none';
