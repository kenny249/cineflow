-- Brand assets storage bucket (admin-only upload, public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  20971520, -- 20MB limit
  ARRAY['image/jpeg','image/png','image/svg+xml','image/webp','image/gif','image/avif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (logos need to be publicly accessible)
CREATE POLICY "brand_assets_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'brand-assets');

-- Only authenticated users can upload (admin check happens in API route)
CREATE POLICY "brand_assets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'brand-assets');
