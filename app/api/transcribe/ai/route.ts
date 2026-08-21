import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { requireActivePlan } from "@/lib/billing-server";
import { isRateLimited } from "@/lib/rate-limit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface FormatConfig {
  label: string;
  durationHint: string;
  guidance: string;
  cutLabels: string;
}

// Each format gets genuinely different editorial direction, not just a
// relabeled version of the same hook-first social structure — a Commercial
// and a Documentary trailer should never come out edited the same way.
const FORMAT_CONFIG: Record<string, FormatConfig> = {
  reel_30: {
    label: "30-Second Instagram Reel",
    durationHint: "15–30 seconds",
    guidance: "Hook-first, fast-moving social pacing. Open on the single strongest line — no windup. Every cut should earn the next three seconds of attention.",
    cutLabels: "HOOK, CORE MESSAGE, STORY BEAT, HUMOR BEAT, EMOTIONAL BEAT, ENERGY HIT, TRANSITION, CALLBACK, CLOSE, OUTRO",
  },
  reel_60: {
    label: "60-Second Instagram Reel",
    durationHint: "45–60 seconds",
    guidance: "Hook-first, fast-moving social pacing. Open on the single strongest line — no windup. Every cut should earn the next three seconds of attention.",
    cutLabels: "HOOK, CORE MESSAGE, STORY BEAT, HUMOR BEAT, EMOTIONAL BEAT, ENERGY HIT, TRANSITION, CALLBACK, CLOSE, OUTRO",
  },
  tiktok: {
    label: "TikTok (15–60 seconds)",
    durationHint: "15–60 seconds",
    guidance: "Hook-first, fast-moving social pacing. Open on the single strongest line — no windup. Every cut should earn the next three seconds of attention.",
    cutLabels: "HOOK, CORE MESSAGE, STORY BEAT, HUMOR BEAT, EMOTIONAL BEAT, ENERGY HIT, TRANSITION, CALLBACK, CLOSE, OUTRO",
  },
  podcast: {
    label: "Podcast Highlight (2–3 minutes)",
    durationHint: "2–3 minutes",
    guidance: "Conversational pacing — let moments breathe more than a social cut would. Prioritize the most insightful, surprising, or quotable exchanges over pure energy.",
    cutLabels: "HOOK, CORE MESSAGE, STORY BEAT, HUMOR BEAT, EMOTIONAL BEAT, ENERGY HIT, TRANSITION, CALLBACK, CLOSE, OUTRO",
  },
  youtube_short: {
    label: "YouTube Short (under 60 seconds)",
    durationHint: "under 60 seconds",
    guidance: "Hook-first, fast-moving social pacing. Open on the single strongest line — no windup. Every cut should earn the next three seconds of attention.",
    cutLabels: "HOOK, CORE MESSAGE, STORY BEAT, HUMOR BEAT, EMOTIONAL BEAT, ENERGY HIT, TRANSITION, CALLBACK, CLOSE, OUTRO",
  },
  commercial: {
    label: "Commercial / Ad Spot",
    durationHint: "15–60 seconds",
    guidance: "Built for paid placement. Structure around a persuasive arc: hook the viewer, name the problem or pain point, deliver the value proposition, back it with proof if the transcript has it, and land on a clear call to action. Assertive, confident tone — this has to convert, not just entertain.",
    cutLabels: "HOOK, PROBLEM, VALUE PROP, PROOF, CALL TO ACTION, CLOSE",
  },
  brand_video: {
    label: "Website / Brand Video",
    durationHint: "60–180 seconds",
    guidance: "Not hook-first — this plays on a website to someone already curious. Measured, confident pacing that establishes who they are, what they do, and why it matters, backed by real proof points from the transcript. Close on an invitation, not an aggressive pitch.",
    cutLabels: "OPENING, WHO WE ARE, WHAT WE DO, WHY IT MATTERS, PROOF POINT, INVITATION",
  },
  testimonial: {
    label: "Testimonial / Case Study",
    durationHint: "60–120 seconds",
    guidance: "Find the real narrative arc in what they said: the problem or pain point before they found this solution, the turning point or decision to work together, what the work actually looked like, and the concrete result. Prioritize specific, credible detail over generic praise.",
    cutLabels: "PROBLEM, TURNING POINT, THE WORK, RESULT, RECOMMENDATION",
  },
  trailer: {
    label: "Trailer / Sizzle Reel",
    durationHint: "30–90 seconds",
    guidance: "Teaser pacing — build intrigue and escalate energy, but never resolve the story or give away the ending. Favor ambiguous, evocative lines over ones that explain too much. End on tension or a bold statement, not a conclusion.",
    cutLabels: "TEASE, ESCALATION, TENSION PEAK, CLIFFHANGER",
  },
  wedding: {
    label: "Wedding Highlight",
    durationHint: "2–4 minutes",
    guidance: "Emotional narrative arc, not a marketing hook. Favor genuine warmth, laughter, and vulnerable moments over anything that sounds like content. Build from anticipation through connection to an emotional peak, and close on something warm and celebratory.",
    cutLabels: "ANTICIPATION, CONNECTION, EMOTIONAL PEAK, JOY, CLOSING",
  },
  documentary: {
    label: "Documentary / Long-form",
    durationHint: "3–6 minutes",
    guidance: "Thematic arc, not hook-first. Establish context and theme, develop real complexity or conflict from the transcript, build toward a turning point, and land on a resolution or a genuinely thought-provoking closing line. Let it breathe — this is not optimized for retention, it's optimized for truth.",
    cutLabels: "OPENING IMAGE, CONTEXT, COMPLICATION, TURNING POINT, CLIMAX, RESOLUTION",
  },
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

    // ── Video cut list ──────────────────────────────────────────────────────
    const config = FORMAT_CONFIG[format];
    const formatLabel = config?.label ?? format;
    const vibeStr = vibes?.length ? `\nVibe/Energy: ${vibes.join(", ")}` : "";
    const briefStr = brief?.trim() ? `\nDirector's Brief: "${brief.trim()}"` : "\nNo specific brief — use your best editorial judgment.";
    const cutLabels = config?.cutLabels ?? "HOOK, CORE MESSAGE, STORY BEAT, HUMOR BEAT, EMOTIONAL BEAT, ENERGY HIT, TRANSITION, CALLBACK, CLOSE, OUTRO";
    const durationHint = config?.durationHint ?? "under 60 seconds";

    const prompt = `You are a senior video editor and content strategist at a top-tier media agency. You have an exceptional eye for storytelling, pacing, and what makes content perform for the specific format you're cutting.

You have been given a raw transcript and creative direction. Your job is to produce an actionable cut list — a precise editorial plan that an editor can follow immediately to build the final video.

TARGET FORMAT: ${formatLabel} (target length: ${durationHint})
EDITORIAL DIRECTION FOR THIS FORMAT: ${config?.guidance ?? "Hook-first, fast-moving social pacing."}${vibeStr}${briefStr}

RAW TRANSCRIPT:
${transcript}

Study the transcript carefully. Find the strongest soundbites, emotional beats, humor moments, and quotable lines. Then design the optimal edit sequence for this specific format's editorial direction and vision — not a generic template.

CRITICAL — every "quote" must be words the speaker actually said, appearing together as one continuous passage in the transcript above. Do not invent lines, do not paraphrase into something punchier, and do not stitch together sentences from different parts of the transcript into a single "quote" — that quote will be physically cut from the real audio, so it has to exist there. Cleaning up stutters and filler words within a single passage is fine (e.g. "it's it's it's hard to explain" → "it's hard to explain" is still the same real passage). Rewriting or merging separate statements is not — if no single real passage says what you wish it said, pick the closest real one instead of manufacturing a better one.

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

Cut labels to use: ${cutLabels} — pick what fits each moment. These are for THIS format specifically; use them, not a generic set.`;

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
