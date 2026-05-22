-- Track which automated reminder emails have been sent per invoice
-- to prevent duplicate sends across cron runs.
-- Value is a JSONB object: { "due_soon": "2026-05-20", "overdue": "2026-05-25" }
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '{}'::jsonb;
