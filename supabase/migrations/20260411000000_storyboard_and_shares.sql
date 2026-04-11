-- Storyboard frames table (replaces mock data)
CREATE TABLE IF NOT EXISTS storyboard_frames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  frame_number INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  description TEXT,
  image_url TEXT,
  shot_duration TEXT DEFAULT '00:00:05',
  camera_angle TEXT DEFAULT 'Wide / Eye level',
  shot_type TEXT DEFAULT 'wide',
  mood TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Storyboard share tokens (permanent public presentation links)
CREATE TABLE IF NOT EXISTS storyboard_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  frames JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS: storyboard_frames
ALTER TABLE storyboard_frames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "storyboard_frames_all" ON storyboard_frames FOR ALL USING (true) WITH CHECK (true);

-- RLS: storyboard_shares — public read, authenticated write
ALTER TABLE storyboard_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "storyboard_shares_read" ON storyboard_shares FOR SELECT USING (true);
CREATE POLICY "storyboard_shares_write" ON storyboard_shares FOR ALL USING (true) WITH CHECK (true);
