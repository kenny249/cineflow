import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActivePlan } from "@/lib/billing-server";
import { isRateLimited } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function mapShotType(type?: string): string {
  const valid = ["wide", "medium", "close_up", "extreme_close_up", "overhead", "drone", "pov", "other"];
  return valid.includes(type ?? "") ? type! : "medium";
}

function parseDuration(dur?: string): number {
  if (!dur) return 5;
  const parts = dur.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(parts[0]) || 5;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const planError = await requireActivePlan(supabase, user.id);
    if (planError) return planError;

    if (await isRateLimited(`ai:flow:${user.id}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Rate limit reached — try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { type } = body;

    // ── Storyboard → Shot List (direct mapping, no AI needed) ────────────────
    if (type === "storyboard-to-shotlist") {
      const { frames } = body as { frames: Array<{
        title?: string; description?: string; shot_type?: string;
        camera_angle?: string; shot_duration?: string; mood?: string; notes?: string;
      }> };

      const shots = frames.map((frame, i) => {
        const noteParts = [
          frame.description,
          frame.mood ? `Mood: ${frame.mood}` : null,
          frame.notes,
        ].filter(Boolean);

        return {
          shot_number: i + 1,
          scene: frame.title ?? undefined,
          description: frame.title || frame.description || `Shot ${i + 1}`,
          shot_type: mapShotType(frame.shot_type),
          camera_movement: "static",
          camera_angle: frame.camera_angle ?? undefined,
          notes: noteParts.length > 0 ? noteParts.join(" · ") : undefined,
          duration_seconds: parseDuration(frame.shot_duration),
          is_complete: false,
        };
      });

      return NextResponse.json({ shots });
    }

    // ── Script → Shot List ────────────────────────────────────────────────────
    if (type === "script-to-shotlist") {
      const { scriptContent, projectTitle } = body as { scriptContent: string; projectTitle?: string };

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `You are a professional 1st Assistant Director breaking down a screenplay into a production shot list for "${projectTitle || "this project"}".

Analyze the script and generate a practical shot list covering the key scenes and moments.

Respond ONLY with a valid JSON array — no text before or after:
[
  {
    "shot_number": 1,
    "scene": "Scene heading (e.g. INT. COFFEE SHOP - DAY)",
    "description": "What the camera captures",
    "shot_type": "wide|medium|close_up|extreme_close_up|overhead|drone|pov|other",
    "camera_movement": "static|pan|tilt|dolly|handheld|crane|other",
    "location": "Location name",
    "lens": "e.g. 35mm or leave empty",
    "notes": "Any special requirements",
    "duration_seconds": 5
  }
]

Rules:
- Generate 1-3 shots per scene based on complexity
- Be specific and practical — these go on a real call sheet
- Vary shot types to create visual coverage
- Keep descriptions concise but clear for crew`,
        messages: [{
          role: "user",
          content: `Break this script into a shot list:\n\n${scriptContent.slice(0, 15000)}`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return NextResponse.json({ error: "Could not parse shot list from response" }, { status: 500 });

      try {
        const shots = JSON.parse(match[0]);
        return NextResponse.json({ shots });
      } catch {
        return NextResponse.json({ error: "Invalid JSON in response" }, { status: 500 });
      }
    }

    // ── Script → Storyboard ───────────────────────────────────────────────────
    if (type === "script-to-storyboard") {
      const { scriptContent, projectTitle } = body as { scriptContent: string; projectTitle?: string };

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `You are a creative director and storyboard artist visualizing a screenplay for "${projectTitle || "this project"}".

Create a storyboard that captures the visual essence of the script — key establishing shots, dramatic moments, and cinematic transitions.

Respond ONLY with a valid JSON array — no text before or after:
[
  {
    "title": "Brief scene/shot title",
    "description": "Detailed visual description of the frame — what the audience sees",
    "shot_type": "wide|medium|close_up|extreme_close_up|overhead|drone|pov|other",
    "camera_angle": "Eye level|Low angle|High angle|Dutch angle|Over the shoulder",
    "shot_duration": "00:00:05",
    "mood": "e.g. Tense, Warm, Cinematic, Moody, Frenetic",
    "notes": "Lighting, lens, action cues, or director notes"
  }
]

Rules:
- Generate 5-8 frames that tell the visual story
- Prioritize establishing shots, emotional peaks, and key transitions
- Think cinematically — reference mood, lighting, and composition
- Each frame should be distinct and purposeful`,
        messages: [{
          role: "user",
          content: `Create a storyboard for this script:\n\n${scriptContent.slice(0, 15000)}`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return NextResponse.json({ error: "Could not parse storyboard from response" }, { status: 500 });

      try {
        const frames = JSON.parse(match[0]);
        return NextResponse.json({ frames });
      } catch {
        return NextResponse.json({ error: "Invalid JSON in response" }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Unknown flow type" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Flow generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
