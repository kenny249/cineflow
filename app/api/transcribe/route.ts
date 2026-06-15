import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { requireActivePlan } from "@/lib/billing-server";
import { isRateLimited } from "@/lib/rate-limit";

export const maxDuration = 120;
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
  if (await isRateLimited(`ai:transcribe:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Transcription service not configured — OPENAI_API_KEY missing." }, { status: 503 });

  const { path } = await req.json();
  if (!path) return NextResponse.json({ error: "No file path provided" }, { status: 400 });

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
  return NextResponse.json({ text: data.text, duration: data.duration ?? null });
}
