-- Lets admins mark a feedback submission as resolved/actioned so the Feedback
-- inbox doesn't keep showing already-fixed requests as if nothing happened —
-- the direct cause of not being able to tell, at a glance, whether a given
-- piece of feedback (e.g. shot editing, inspo photo upload) still needs work.
alter table public.feedback add column if not exists resolved_at timestamptz;
