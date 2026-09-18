import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActivePlan } from "@/lib/billing-server";
import { isRateLimited } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const planError = await requireActivePlan(supabase, user.id);
  if (planError) return planError;
  if (await isRateLimited(`ai:breakdown:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const { content, filename } = await req.json() as { content: string; filename: string };

  if (!content?.trim()) {
    return NextResponse.json({ error: "No script content provided" }, { status: 400 });
  }

  // Trim to ~80k chars to stay well within context limits
  const trimmed = content.slice(0, 80_000);

  const prompt = `You are a professional script supervisor and line producer at a top-tier production company. Analyze the following script and produce a complete, detailed production breakdown.

SCRIPT (${filename}):
---
${trimmed}
---

Return ONLY valid JSON matching this exact structure. Be thorough — this breakdown will be used by a real production team to plan their shoot.

{
  "title": "Script title (infer from content or use filename)",
  "logline": "One sentence summary of the story",
  "genre": "Genre (e.g. Drama, Commercial, Documentary, Music Video, etc.)",
  "format": "Format (e.g. Feature Film, Short Film, Commercial, Web Series, etc.)",
  "totalPages": <number or null if unknown>,
  "estimatedShootDays": <number — be realistic based on scene complexity>,
  "productionComplexity": "low | medium | high | very_high",
  "synopsis": "2-3 sentence synopsis",
  "scenes": [
    {
      "number": <scene number>,
      "heading": "Full scene heading as written (e.g. INT. COFFEE SHOP - DAY)",
      "interior": <true if INT, false if EXT>,
      "location": "Location name only (e.g. Coffee Shop)",
      "timeOfDay": "DAY | NIGHT | DUSK | DAWN | CONTINUOUS | LATER | FLASHBACK",
      "characters": ["CHARACTER NAME", ...],
      "action": "Brief 1-2 sentence description of what happens",
      "props": ["prop name", ...],
      "specialNotes": "Any VFX, stunts, special equipment, weather notes, etc. or null"
    }
  ],
  "characters": [
    {
      "name": "CHARACTER NAME",
      "description": "Brief character description based on context",
      "sceneCount": <number of scenes they appear in>,
      "scenes": [<scene numbers>],
      "isLead": <true if major character>,
      "estimatedScreenTime": "lead | supporting | day player | background"
    }
  ],
  "locations": [
    {
      "name": "Location name",
      "interior": <true/false — null if both>,
      "sceneCount": <number>,
      "scenes": [<scene numbers>],
      "notes": "Any special location requirements or null"
    }
  ],
  "props": [
    "Complete list of all props mentioned or implied across all scenes"
  ],
  "wardrobe": [
    "Key wardrobe items or costume requirements mentioned"
  ],
  "specialEquipment": [
    "Drone", "Underwater housing", "Gimbal", etc. — only list what the script actually needs
  ],
  "vfx": [
    {
      "scene": <scene number>,
      "description": "VFX shot description"
    }
  ],
  "stunts": [
    {
      "scene": <scene number>,
      "description": "Stunt description"
    }
  ],
  "productionNotes": "Overall production notes — complexity flags, scheduling challenges, budget considerations, anything a producer should know"
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    // Don't assume content[0] is the text block — a non-text block first
    // (e.g. thinking) would otherwise silently produce an empty string here.
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

    if (response.stop_reason === "max_tokens") {
      console.error("[api/scripts/breakdown] truncated at max_tokens", {
        contentTypes: response.content.map((b) => b.type),
        textLength: text.length,
      });
      return NextResponse.json(
        { error: "The breakdown was too long to complete — try a shorter script or split it into sections." },
        { status: 500 }
      );
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[api/scripts/breakdown] no JSON found in response", {
        contentTypes: response.content.map((b) => b.type),
        stopReason: response.stop_reason,
        textPreview: text.slice(0, 500),
      });
      return NextResponse.json({ error: "Failed to parse breakdown" }, { status: 500 });
    }

    let result: unknown;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[api/scripts/breakdown] JSON.parse failed", {
        message: parseErr instanceof Error ? parseErr.message : parseErr,
        matchPreview: jsonMatch[0].slice(0, 500),
      });
      return NextResponse.json({ error: "Failed to parse breakdown" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[api/scripts/breakdown]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Breakdown failed" },
      { status: 500 }
    );
  }
}
