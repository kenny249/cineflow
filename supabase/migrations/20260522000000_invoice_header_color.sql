-- Add header_color column to invoices for per-invoice header background customization
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS header_color TEXT;
