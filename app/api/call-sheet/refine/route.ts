import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (await isRateLimited(user.id, "call-sheet-refine", 20, 60)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { person, role, equipment, responsibilities, mode, projectTitle } = await req.json();
  if (!responsibilities?.length || !mode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const bulletList = (responsibilities as string[]).map((r: string) => `• ${r}`).join("\n");

  const prompt = mode === "tighten"
    ? `You are editing a professional film/event call sheet. The responsibilities below are too verbose for on-set use. Crew need to scan this in 5 seconds.

Rewrite as 2-4 SHORT punchy bullets. Rules:
- Max 8 words per bullet
- No full sentences — use fragments ("Capture hero angles on decks", not "Capture the hero angles on the decks during performance")
- Keep specifics (times, gear names, location names, coordination cues)
- Drop filler words and generic phrases

Person: ${person}
Role: ${role}
Equipment: ${equipment || "n/a"}
Project: ${projectTitle || ""}

Current responsibilities:
${bulletList}

Return ONLY a valid JSON array of strings. No explanation, no markdown, no code fences.
Example: ["BTS: artist arrival + green room", "Hero angles during drops — decks + face", "Coordinate with Kenny on crowd reaction timing"]`
    : `You are writing a professional film/event call sheet. Expand these brief notes into 4-6 detailed responsibilities a crew member can execute independently.

Include: specific moments/shots to capture, gear usage, coordination cues with other crew, timing notes.
Write as full but concise sentences (1 line each, not paragraphs).

Person: ${person}
Role: ${role}
Equipment: ${equipment || "n/a"}
Project: ${projectTitle || ""}

Current notes:
${bulletList}

Return ONLY a valid JSON array of strings. No explanation, no markdown, no code fences.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as any).text?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?|```$/gm, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed) || !parsed.every((r: unknown) => typeof r === "string")) {
      throw new Error("Invalid response shape");
    }

    return NextResponse.json({ responsibilities: parsed });
  } catch (err: any) {
    console.error("[call-sheet/refine]", err);
    return NextResponse.json({ error: err.message ?? "Refine failed" }, { status: 500 });
  }
}
