import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transcript, format, brief, vibes } = await req.json();
  if (!transcript) return NextResponse.json({ error: "No transcript provided" }, { status: 400 });

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

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No valid JSON in response");

    const cutList = JSON.parse(match[0]);
    return NextResponse.json({ cutList });
  } catch (err: any) {
    console.error("[transcribe/ai]", err);
    return NextResponse.json({ error: err.message ?? "AI generation failed" }, { status: 500 });
  }
}
