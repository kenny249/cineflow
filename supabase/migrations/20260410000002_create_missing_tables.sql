-- Create missing enum types (safe if already exist)
DO $$ BEGIN
  CREATE TYPE shot_status AS ENUM ('planned', 'filming', 'completed', 'review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE revision_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('shoot', 'meeting', 'deadline', 'milestone', 'delivery', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add delivery/other to event_type if it already existed without them
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'delivery';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'other';

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  ) STORED,
  email TEXT,
  company TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'filmmaker',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Project members table
CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(project_id, user_id)
);

-- Project notes table
CREATE TABLE IF NOT EXISTS project_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Shot lists table
CREATE TABLE IF NOT EXISTS shot_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Shot list items table
CREATE TABLE IF NOT EXISTS shot_list_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shot_list_id UUID REFERENCES shot_lists(id) ON DELETE CASCADE NOT NULL,
  shot_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  status shot_status DEFAULT 'planned' NOT NULL,
  is_complete BOOLEAN DEFAULT false,
  notes TEXT,
  shot_type TEXT DEFAULT 'other',
  camera_movement TEXT DEFAULT 'static',
  lens TEXT,
  scene TEXT,
  category TEXT,
  duration_seconds INTEGER,
  camera_angle TEXT,
  lighting_setup TEXT,
  location TEXT,
  props TEXT[],
  actors TEXT[],
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Storyboard frames table
CREATE TABLE IF NOT EXISTS storyboard_frames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  shot_list_item_id UUID REFERENCES shot_list_items(id) ON DELETE SET NULL,
  frame_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  shot_duration TEXT,
  camera_angle TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Revisions table
CREATE TABLE IF NOT EXISTS revisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status revision_status DEFAULT 'pending' NOT NULL,
  version_number INTEGER NOT NULL,
  file_url TEXT,
  file_type TEXT,
  file_size BIGINT,
  thumbnail_url TEXT,
  feedback TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Revision comments table
CREATE TABLE IF NOT EXISTS revision_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  revision_id UUID REFERENCES revisions(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type event_type NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  attendees UUID[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE storyboard_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow all on project_members" ON project_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on project_notes" ON project_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shot_lists" ON shot_lists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shot_list_items" ON shot_list_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on storyboard_frames" ON storyboard_frames FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on revisions" ON revisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on revision_comments" ON revision_comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on calendar_events" ON calendar_events FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_project_id ON shot_lists(project_id);
CREATE INDEX IF NOT EXISTS idx_shot_list_items_shot_list_id ON shot_list_items(shot_list_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_frames_project_id ON storyboard_frames(project_id);
CREATE INDEX IF NOT EXISTS idx_revisions_project_id ON revisions(project_id);
CREATE INDEX IF NOT EXISTS idx_revision_comments_revision_id ON revision_comments(revision_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
