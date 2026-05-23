-- When a project status changes to 'delivered', automatically deactivate
-- all active collaborators. Their collab portal view filters on status='active'
-- so they lose access immediately without any row deletion.

CREATE OR REPLACE FUNCTION deactivate_project_collaborators()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    UPDATE project_collaborators
    SET status = 'inactive'
    WHERE project_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_delivered ON projects;

CREATE TRIGGER on_project_delivered
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_project_collaborators();
