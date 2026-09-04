import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { TRANSCRIPT_AUDIO_BUCKET, savedTranscriptAudioPath, transcriptAdminClient } from "@/lib/transcript-audio-storage";

export const dynamic = "force-dynamic";

// Mints a signed upload URL for durably storing a transcript's source audio,
// so reopening it later still has real playback/scrub behind it. Ownership
// is checked here — RLS-scoped, not service-role — before the path is ever
// handed out, even though the path itself is already namespaced under the
// caller's own user id and couldn't collide with anyone else's file.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transcriptId, filename } = await req.json();
  if (!transcriptId || typeof transcriptId !== "string") {
    return NextResponse.json({ error: "transcriptId required" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("project_transcripts")
    .select("id")
    .eq("id", transcriptId)
    .single();
  if (error || !row) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  const admin = transcriptAdminClient();
  await admin.storage.createBucket(TRANSCRIPT_AUDIO_BUCKET, { public: false }).catch(() => {});
  const path = savedTranscriptAudioPath(user.id, transcriptId, filename ?? "audio.mp3");

  const { data, error: urlError } = await admin.storage
    .from(TRANSCRIPT_AUDIO_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (urlError || !data) {
    return NextResponse.json({ error: urlError?.message ?? "Could not create upload URL" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, path });
}
