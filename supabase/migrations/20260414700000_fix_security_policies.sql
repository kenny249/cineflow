-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 1: Invoices RLS was broken
-- The "authenticated can manage invoices" policy was dropped in security_hardening
-- but no replacement was added, leaving the table with RLS enabled but no policy.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Users can manage their own invoices" ON invoices
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 2: form_responses needs RLS so one user cannot read another user's responses
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

-- Form owners can view responses to their own forms
CREATE POLICY "Form owners can view responses" ON form_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forms WHERE id = form_id AND created_by = auth.uid()
    )
  );

-- Anyone can submit a response (forms are public — authenticated via token at app layer)
CREATE POLICY "Anyone can submit form response" ON form_responses
  FOR INSERT
  WITH CHECK (true);
