-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create custom types
CREATE TYPE project_status AS ENUM ('draft', 'active', 'review', 'completed', 'archived');
CREATE TYPE project_type AS ENUM ('commercial', 'documentary', 'music_video', 'short_film', 'corporate', 'wedding', 'event', 'other');
CREATE TYPE shot_status AS ENUM ('planned', 'filming', 'completed', 'review');
CREATE TYPE revision_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE event_type AS ENUM ('shoot', 'meeting', 'deadline', 'milestone');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  type project_type DEFAULT 'commercial' NOT NULL,
  tags TEXT[],
  shoot_date DATE,
  status project_status DEFAULT 'draft' NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  due_date DATE,
  thumbnail_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Project members table
CREATE TABLE project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' NOT NULL, -- 'owner', 'admin', 'member', 'viewer'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(project_id, user_id)
);

-- Project notes table
CREATE TABLE project_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Shot lists table
CREATE TABLE shot_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Shot list items table
CREATE TABLE shot_list_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shot_list_id UUID REFERENCES shot_lists(id) ON DELETE CASCADE NOT NULL,
  shot_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  status shot_status DEFAULT 'planned' NOT NULL,
  notes TEXT,
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
CREATE TABLE storyboard_frames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  shot_list_item_id UUID REFERENCES shot_list_items(id) ON DELETE SET NULL,
  frame_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Revisions table
CREATE TABLE revisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status revision_status DEFAULT 'pending' NOT NULL,
  version_number INTEGER NOT NULL,
  file_url TEXT,
  thumbnail_url TEXT,
  feedback TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Revision comments table
CREATE TABLE revision_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  revision_id UUID REFERENCES revisions(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Calendar events table
CREATE TABLE calendar_events (
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

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE storyboard_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create policies for projects (simplified - allow all for now during development)
CREATE POLICY "Allow all operations on projects for development" ON projects
  FOR ALL USING (true);

-- Create policies for project_members
CREATE POLICY "Allow all operations on project_members for development" ON project_members
  FOR ALL USING (true);

-- Create policies for project_notes
CREATE POLICY "Allow all operations on project_notes for development" ON project_notes
  FOR ALL USING (true);

-- Create policies for shot_lists
CREATE POLICY "Allow all operations on shot_lists for development" ON shot_lists
  FOR ALL USING (true);

-- Create policies for shot_list_items
CREATE POLICY "Allow all operations on shot_list_items for development" ON shot_list_items
  FOR ALL USING (true);

-- Create policies for storyboard_frames
CREATE POLICY "Allow all operations on storyboard_frames for development" ON storyboard_frames
  FOR ALL USING (true);

-- Create policies for revisions
CREATE POLICY "Allow all operations on revisions for development" ON revisions
  FOR ALL USING (true);

-- Create policies for revision_comments
CREATE POLICY "Allow all operations on revision_comments for development" ON revision_comments
  FOR ALL USING (true);

-- Create policies for calendar_events
CREATE POLICY "Allow all operations on calendar_events for development" ON calendar_events
  FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX idx_shot_lists_project_id ON shot_lists(project_id);
CREATE INDEX idx_shot_list_items_shot_list_id ON shot_list_items(shot_list_id);
CREATE INDEX idx_storyboard_frames_project_id ON storyboard_frames(project_id);
CREATE INDEX idx_revisions_project_id ON revisions(project_id);
CREATE INDEX idx_revision_comments_revision_id ON revision_comments(revision_id);
CREATE INDEX idx_calendar_events_project_id ON calendar_events(project_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_end_time ON calendar_events(end_time);

-- Create function to handle profile creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, company)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'company'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at on all tables
CREATE TRIGGER handle_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_projects
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_project_notes
  BEFORE UPDATE ON project_notes
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_shot_lists
  BEFORE UPDATE ON shot_lists
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_shot_list_items
  BEFORE UPDATE ON shot_list_items
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_storyboard_frames
  BEFORE UPDATE ON storyboard_frames
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_revisions
  BEFORE UPDATE ON revisions
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_revision_comments
  BEFORE UPDATE ON revision_comments
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER handle_updated_at_calendar_events
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();