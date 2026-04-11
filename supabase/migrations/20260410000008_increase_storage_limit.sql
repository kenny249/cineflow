-- Increase project-files bucket file size limit to 5 GB (Supabase Pro)
UPDATE storage.buckets
SET file_size_limit = 5368709120  -- 5 GB in bytes
WHERE id = 'project-files';
