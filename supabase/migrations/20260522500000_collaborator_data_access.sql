-- ── Collaborator read access to project data ─────────────────────────────────
-- Active project collaborators need read access to project details, shot lists,
-- tasks, crew contacts, and locations for their assigned project.

-- projects: collaborators can view their assigned project
CREATE POLICY "Collaborators can view their assigned project" ON projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- shot_lists: read-only for collaborators
CREATE POLICY "Collaborators can view shot lists" ON shot_lists
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- shot_list_items: read-only for collaborators
CREATE POLICY "Collaborators can view shot list items" ON shot_list_items
  FOR SELECT USING (
    shot_list_id IN (
      SELECT id FROM shot_lists WHERE project_id IN (
        SELECT project_id FROM project_collaborators
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- crew_contacts: read-only for collaborators
CREATE POLICY "Collaborators can view crew contacts" ON crew_contacts
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- project_locations: read-only for collaborators
CREATE POLICY "Collaborators can view project locations" ON project_locations
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- project_tasks: read-only for collaborators
CREATE POLICY "Collaborators can view project tasks" ON project_tasks
  FOR SELECT USING (
    project_id IS NOT NULL
    AND project_id IN (
      SELECT project_id FROM project_collaborators
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
