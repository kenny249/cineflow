-- The "Wrap" expense/trip-tracking feature (wrap_receipts, wrap_trips,
-- wrap_notes) was built at the database layer and tested once (1 trip, 2
-- notes, 2 receipt photos — all from a single early test), but no
-- application code anywhere ever shipped a UI for it. Confirmed not
-- coming back — removing entirely rather than leaving orphaned tables and
-- an orphaned bucket sitting around. The storage-policy tightening
-- earlier already locked this bucket down; this finishes the job.
drop table if exists wrap_receipts;
drop table if exists wrap_trips;
drop table if exists wrap_notes;
-- The wrap-receipts storage bucket itself is removed separately via the
-- Storage API (emptyBucket + deleteBucket), not a raw SQL delete here —
-- that's the API-safe way to actually clear the underlying blob storage,
-- not just the metadata row.
