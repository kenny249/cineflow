-- Durable playback support for saved transcripts: word-level timestamps and
-- a pointer to the original audio in storage, so reopening a transcript from
-- the library later gets the same click-to-seek/scrub/timecode experience as
-- a live session, not just text. Both nullable — older transcripts saved
-- before this feature simply fall back to the plain-text view, same as today.
--
-- No RLS changes needed: project_transcripts' existing owner-scoped policy
-- was verified live (a real second account cannot read another user's row,
-- filtered or unfiltered) and covers these new columns automatically.
alter table project_transcripts add column if not exists words jsonb;
alter table project_transcripts add column if not exists audio_path text;

comment on column project_transcripts.words is
  'Whisper word-level timestamps ({word,start,end}[]), same shape used for cut-list quote grounding. Null for transcripts saved before this existed.';
comment on column project_transcripts.audio_path is
  'Path within the private audio-transcriptions bucket, e.g. "<user_id>/saved/<transcript_id>.<ext>". Null if audio was never persisted (saved before this feature, or the upload failed).';
