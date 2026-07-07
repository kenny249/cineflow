-- Backfill: retype status_changed notifications that were actually client actions.
-- Quote acceptance: title ends with "accepted your quote"
-- Contract signing: title contains "signed" and a quoted string (e.g. signed "Contract Name")

UPDATE notifications
SET type = 'quote_accepted'
WHERE type = 'status_changed'
  AND title ILIKE '%accepted your quote%';

UPDATE notifications
SET type = 'contract_signed'
WHERE type = 'status_changed'
  AND title ~ '.+ signed ".+"';
