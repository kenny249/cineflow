-- Make project-files bucket public so cover photos render everywhere
UPDATE storage.buckets
SET public = true
WHERE id = 'project-files';
