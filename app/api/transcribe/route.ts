import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { requireActivePlan } from "@/lib/billing-server";
import { isRateLimitedByAmount } from "@/lib/rate-limit";

// Budget by total minutes of audio per hour, not request count — one long
// file split into several chunks and several short files should be bounded
// by the same real cost exposure, not penalized differently by shape.
const MINUTES_PER_HOUR_LIMIT = 300;

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BUCKET = "audio-transcriptions";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const planError = await requireActivePlan(supabase, user.id);
  if (planError) return planError;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Transcription service not configured — OPENAI_API_KEY missing." }, { status: 503 });

  const { path, estimatedDurationSec } = await req.json();
  if (!path) return NextResponse.json({ error: "No file path provided" }, { status: 400 });

  // Check the budget before spending a real Whisper call, using the
  // client's known chunk length (it just created the file, so it knows
  // this precisely) — falls back to a conservative estimate if absent so
  // older clients can't bypass the limit by omitting it.
  const minutesToCharge = Math.max(1, Math.ceil((Number(estimatedDurationSec) || 600) / 60));
  if (await isRateLimitedByAmount(`ai:transcribe-minutes:${user.id}`, minutesToCharge, MINUTES_PER_HOUR_LIMIT, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "You've hit this hour's transcription limit. Try again in a bit." }, { status: 429 });
  }

  // Verify the path belongs to this user
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const admin = getAdmin();

  // Download from Supabase Storage
  const { data: blob, error: dlError } = await admin.storage.from(BUCKET).download(path);
  if (dlError || !blob) {
    return NextResponse.json({ error: "Could not retrieve uploaded file" }, { status: 500 });
  }

  // Clean up the temp file regardless of transcription outcome
  admin.storage.from(BUCKET).remove([path]).catch(() => {});

  const filename = path.split("/").pop() ?? "audio.mp3";
  const file = new File([blob], filename, { type: blob.type || "audio/mpeg" });

  const whisperForm = new FormData();
  whisperForm.append("file", file);
  whisperForm.append("model", "whisper-1");
  whisperForm.append("response_format", "verbose_json");
  whisperForm.append("timestamp_granularities[]", "word");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err.error?.message ?? `OpenAI error ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  // Real per-word timestamps from the source audio — used to ground AI-picked
  // soundbites in exact cut points instead of the model's guessed edit timeline.
  const words = Array.isArray(data.words)
    ? data.words.map((w: any) => ({ word: String(w.word ?? ""), start: Number(w.start ?? 0), end: Number(w.end ?? 0) }))
    : [];
  return NextResponse.json({ text: data.text, duration: data.duration ?? null, words });
}
