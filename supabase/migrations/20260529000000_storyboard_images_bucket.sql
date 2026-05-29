-- Create storyboard-images storage bucket
-- This was missing — storyboard image uploads fail without it

INSERT INTO storage.buckets (id, name, public)
VALUES ('storyboard-images', 'storyboard-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Auth users can upload storyboard images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'storyboard-images');

CREATE POLICY "Anyone can view storyboard images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'storyboard-images');

CREATE POLICY "Auth users can update storyboard images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'storyboard-images');

CREATE POLICY "Users can delete their storyboard images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'storyboard-images');
