-- Add recipient_role to contracts for crew/client/talent organization
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS recipient_role TEXT DEFAULT 'client'
    CHECK (recipient_role IN ('client', 'crew', 'talent', 'location', 'vendor', 'other'));
