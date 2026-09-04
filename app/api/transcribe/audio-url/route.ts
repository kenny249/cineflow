import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { TRANSCRIPT_AUDIO_BUCKET, transcriptAdminClient } from "@/lib/transcript-audio-storage";

export const dynamic = "force-dynamic";

// Signed playback URL for a saved transcript's durably-stored audio. The
// ownership check happens on the RLS-scoped row lookup (a stranger's fetch
// simply finds no row), not on the storage layer — the bucket itself has no
// public access at all, only this service-role-minted, short-lived URL.
export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("project_transcripts")
    .select("audio_path")
    .eq("id", id)
    .single();
  if (error || !row) return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  if (!row.audio_path) return NextResponse.json({ error: "No audio stored for this transcript" }, { status: 404 });

  const admin = transcriptAdminClient();
  const { data, error: signError } = await admin.storage
    .from(TRANSCRIPT_AUDIO_BUCKET)
    .createSignedUrl(row.audio_path, 60 * 60 * 4); // 4 hours — long enough for one sitting
  if (signError || !data) {
    return NextResponse.json({ error: signError?.message ?? "Could not sign audio URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
