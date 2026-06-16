import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { requireActivePlan } from "@/lib/billing-server";
import { isRateLimited } from "@/lib/rate-limit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FORMAT_LABELS: Record<string, string> = {
  reel_30: "30-Second Instagram Reel",
  reel_60: "60-Second Instagram Reel",
  tiktok: "TikTok (15–60 seconds)",
  podcast: "Podcast Highlight (2–3 minutes)",
  youtube_short: "YouTube Short (under 60 seconds)",
};

const MEETING_FORMATS = new Set(["meeting_summary", "key_takeaways"]);

function parseJSON(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No valid JSON in response");
  return JSON.parse(
    match[0]
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\x00-\x1F\x7F]/g, " ")
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const planError = await requireActivePlan(supabase, user.id);
  if (planError) return planError;
  if (await isRateLimited(`ai:transcribe-ai:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const { transcript, format, brief, vibes } = await req.json();
  if (!transcript) return NextResponse.json({ error: "No transcript provided" }, { status: 400 });

  try {
    if (format === "meeting_summary") {
      const contextStr = brief?.trim() ? `\nContext: "${brief.trim()}"` : "";
      const prompt = `You are an expert meeting facilitator and executive assistant. You've been given a raw transcript of a conversation or meeting.

Your job is to create a clean, professional meeting summary that captures everything important so the reader can understand the full call without re-reading the transcript.${contextStr}

RAW TRANSCRIPT:
${transcript}

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "format": "Meeting Summary",
  "overview": "One clear paragraph (3–5 sentences) covering what this meeting was about, who was involved if mentioned, the main purpose, and overall outcome",
  "topics": [
    "Topic or subject discussed"
  ],
  "key_decisions": [
    "A decision or conclusion that was reached"
  ],
  "action_items": [
    "Specific action — who is responsible if mentioned"
  ],
  "notable_quotes": [
    { "quote": "exact verbatim quote", "speaker": "speaker name or null" }
  ]
}

Include 3–8 items per section as appropriate. Action items must be specific and actionable. Notable quotes should be the most insightful or memorable lines only (2–4 max). Keep each bullet concise (1–2 sentences).`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });
      const raw = message.content[0].type === "text" ? message.content[0].text : "";
      const summary = parseJSON(raw);
      return NextResponse.json({ type: "meeting_summary", summary });
    }

    if (format === "key_takeaways") {
      const contextStr = brief?.trim() ? `\nContext: "${brief.trim()}"` : "";
      const prompt = `You are an expert content analyst. You've been given a raw transcript of a conversation, meeting, or talk.

Your job is to extract the most valuable insights, lessons, and key takeaways — the things worth remembering.${contextStr}

RAW TRANSCRIPT:
${transcript}

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "format": "Key Takeaways",
  "summary": "One sentence describing what this transcript is about and who it's from",
  "takeaways": [
    {
      "headline": "Short memorable headline, 5–8 words",
      "detail": "2–3 sentence explanation that adds context and specifics from what was actually said"
    }
  ]
}

Extract 5–8 of the most valuable, actionable, or insightful takeaways. Each headline should stand alone as a memorable insight. Be specific — no generic filler.`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });
      const raw = message.content[0].type === "text" ? message.content[0].text : "";
      const takeaways = parseJSON(raw);
      return NextResponse.json({ type: "key_takeaways", takeaways });
    }

    // ── Video cut list (existing) ─────────────────────────────────────────────
    const formatLabel = FORMAT_LABELS[format] ?? format;
    const vibeStr = vibes?.length ? `\nVibe/Energy: ${vibes.join(", ")}` : "";
    const briefStr = brief?.trim() ? `\nDirector's Brief: "${brief.trim()}"` : "\nNo specific brief — use your best editorial judgment.";

    const prompt = `You are a senior video editor and content strategist at a top-tier media agency. You have an exceptional eye for storytelling, pacing, and what makes content perform on social platforms.

You have been given a raw transcript and creative direction. Your job is to produce an actionable cut list — a precise editorial plan that an editor can follow immediately to build the final video.

TARGET FORMAT: ${formatLabel}${vibeStr}${briefStr}

RAW TRANSCRIPT:
${transcript}

Study the transcript carefully. Find the strongest soundbites, emotional beats, humor moments, and quotable lines. Then design the optimal edit sequence for the requested format and vision.

Return ONLY a valid JSON object — no markdown, no explanation outside the JSON:
{
  "format": "${formatLabel}",
  "total_duration": "e.g. 0:28",
  "cuts": [
    {
      "label": "HOOK",
      "timecode_hint": "0:00–0:03",
      "quote": "exact quote from the transcript",
      "speaker": "speaker name if identifiable, otherwise null",
      "note": "why this moment works and how to execute the cut"
    }
  ],
  "caption_suggestions": [
    "caption option 1",
    "caption option 2",
    "caption option 3"
  ],
  "hook_options": [
    "Specific hook strategy 1 (e.g. 'Open on X saying Y, cut before they finish')",
    "Specific hook strategy 2",
    "Specific hook strategy 3"
  ],
  "editor_notes": "Overall pacing notes, suggested music energy, transition style, anything that makes this cut special"
}

Cut labels to use: HOOK, CORE MESSAGE, STORY BEAT, HUMOR BEAT, EMOTIONAL BEAT, ENERGY HIT, TRANSITION, CALLBACK, CLOSE, OUTRO — pick what fits each moment.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const cutList = parseJSON(raw);
    return NextResponse.json({ type: "cut_list", cutList });
  } catch (err: any) {
    console.error("[transcribe/ai]", err);
    return NextResponse.json({ error: err.message ?? "AI generation failed" }, { status: 500 });
  }
}
