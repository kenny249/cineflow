-- Team members table (workspace-level, not project-level)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  avatar_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'active'
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE
);

-- Topics / channels
CREATE TABLE IF NOT EXISTS team_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '💬',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Messages within topics
CREATE TABLE IF NOT EXISTS team_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID REFERENCES team_topics(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on team_members" ON team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on team_topics" ON team_topics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on team_messages" ON team_messages FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_team_messages_topic_id ON team_messages(topic_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_created_at ON team_messages(created_at);

-- Seed a general topic
INSERT INTO team_topics (name, description, emoji)
VALUES ('general', 'Team-wide announcements and updates', '📢')
ON CONFLICT DO NOTHING;
