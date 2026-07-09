-- Proactive issue detection. Failures (client-facing public-page errors, failed
-- invoice emails, payment webhook errors, server errors) are logged here by
-- server code via the service role, and surfaced in the admin Issues panel.
CREATE TABLE IF NOT EXISTS platform_issues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL DEFAULT 'other',   -- public_page_error | email_failed | payment_error | server_error | other
  severity    text NOT NULL DEFAULT 'error',    -- error | warning
  message     text NOT NULL,
  context     jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_issues_unresolved ON platform_issues(created_at DESC) WHERE resolved = false;

ALTER TABLE platform_issues ENABLE ROW LEVEL SECURITY;

-- Reads only for admins; writes happen exclusively via the service role in API
-- routes, so no insert/update policy is needed here.
DROP POLICY IF EXISTS platform_issues_admin_read ON platform_issues;
CREATE POLICY platform_issues_admin_read ON platform_issues FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
