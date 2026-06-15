import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActivePlan } from "@/lib/billing-server";
import { isRateLimited } from "@/lib/rate-limit";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const ACTIONS = {
  expand:      "Expand this into a more detailed and complete version. Keep the same format and style.",
  rewrite:     "Rewrite this to be clearer, more concise, and more compelling. Keep the same meaning.",
  screenplay:  "Rewrite this in proper screenplay format with scene headings, action lines, and dialogue.",
  variations:  "Generate 3 distinct variations of this content. Separate each with ---.",
  shot_notes:  "Expand these shot notes into a detailed shot description for a cinematographer including camera angle, movement, and visual intent.",
} as const;

type ActionKey = keyof typeof ACTIONS;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const planError = await requireActivePlan(supabase, user.id);
  if (planError) return planError;
  if (await isRateLimited(`ai:board-card:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = await req.json() as { text?: string; action: string; scene?: string };

  // ── AI Scene Breakdown (special action) ──────────────────────────────────────
  if (body.action === "breakdown") {
    const scene = body.scene?.trim();
    if (!scene) return NextResponse.json({ error: "No scene text provided" }, { status: 400 });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a professional script supervisor and director of photography assistant. Break down the provided screenplay scene into individual shots. Output ONLY valid JSON in this format:
{
  "shots": [
    {
      "scene_type": "INT" | "EXT" | "INT/EXT",
      "location": "Location name",
      "time": "DAY" | "NIGHT" | "DAWN" | "DUSK" | "MAGIC HOUR" | "CONTINUOUS",
      "camera_angle": "Shot type and angle (e.g. Medium Shot, Eye Level)",
      "notes": "Brief action description and shot motivation"
    }
  ]
}
Generate between 3 and 10 shots based on the complexity of the scene. Be specific and production-ready.`,
          },
          {
            role: "user",
            content: scene,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 500 });
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json({ shots: parsed.shots ?? [] });
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }
  }

  // ── Standard AI Enhance ───────────────────────────────────────────────────────
  const { text, action } = body as { text: string; action: ActionKey };
  if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });
  if (!ACTIONS[action as ActionKey]) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const instruction = ACTIONS[action as ActionKey];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: "You are a creative assistant for a professional video production studio. Be concise, clear, and production-ready in your output. Do not include preamble or explanation — output only the content itself.",
        },
        {
          role: "user",
          content: `${instruction}\n\n---\n\n${text}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 500 });
  }

  const json = await res.json();
  const result = json.choices?.[0]?.message?.content ?? "";
  return NextResponse.json({ result });
}
