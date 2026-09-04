// Shared conventions for durably-stored transcript audio, used by both
// save-audio-url (upload) and audio-url (playback) routes so the path
// format can't drift between them.
import { createClient } from "@supabase/supabase-js";

export const TRANSCRIPT_AUDIO_BUCKET = "audio-transcriptions";

export function transcriptAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Same bucket the chunk-upload pipeline uses for transient files (which are
// deleted right after transcription), but under a distinct `saved/` prefix
// and keyed by transcript id so it's kept indefinitely and is trivial to
// locate/overwrite on a re-save. Still scoped under the owning user's id as
// the path's first segment — this bucket has no RLS policies of its own
// (nothing reads or writes it except these two service-role-backed routes),
// so the real access control is entirely in the routes' ownership checks,
// not in storage.
export function savedTranscriptAudioPath(userId: string, transcriptId: string, filename: string): string {
  const rawExt = filename.split(".").pop() || "mp3";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "mp3";
  return `${userId}/saved/${transcriptId}.${ext}`;
}
