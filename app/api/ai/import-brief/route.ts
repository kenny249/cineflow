import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActivePlan } from "@/lib/billing-server";
import { isRateLimited } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a production coordinator assistant for a professional video production platform called CineFlow.

Your job is to read a production brief (PDF, Word doc, or plain text) and extract structured data that can be imported into a project management system.

Return ONLY a valid JSON object with this exact structure — no markdown, no explanation, just raw JSON:

{
  "description": "string — the project objective or summary (1-3 sentences max)",
  "project_type": "commercial|documentary|music_video|short_film|feature_film|corporate|wedding|live_event|social_content|podcast|reality_tv|editorial|custom|null",
  "client_name": "string or null",
  "venue": "string or null — venue/location name if mentioned",
  "shoot_date": "string or null — ISO date if mentioned (YYYY-MM-DD)",
  "crew": [
    {
      "name": "string — person's name",
      "role": "string — their job title/role",
      "department": "Camera|Audio|Lighting|Direction|Production|Art|Post|Other",
      "notes": "string or null — any additional context"
    }
  ],
  "equipment": [
    {
      "category": "camera|audio|lighting|support|other",
      "name": "string — equipment name/model",
      "brand": "string or null",
      "assigned_to": "string or null — crew member name this belongs to",
      "role": "string or null — angle, purpose, or position (e.g. Hero Artist, Locked Wide, BTS)",
      "lenses": [
        { "focal_length": "string", "aperture": "string or null", "type": "prime|zoom" }
      ],
      "notes": "string or null"
    }
  ],
  "shots": [
    {
      "title": "string — short shot name",
      "description": "string — what needs to be captured",
      "phase": "pre_show|during_show|post_show|pre_shoot|during_shoot|post_shoot|other",
      "shot_type": "wide|medium|close_up|extreme_close_up|overhead|drone|pov|other",
      "assigned_to": "string or null — crew member responsible",
      "notes": "string or null"
    }
  ],
  "locations": [
    {
      "name": "string — location name",
      "notes": "string or null"
    }
  ]
}

Rules:
- Extract ALL crew members mentioned, including static/mounted cameras as equipment (not crew)
- For cameras mentioned with operators, create both an equipment entry AND note the operator in assigned_to
- If a camera has no person assigned (e.g. mounted, GoPro), still add it as equipment with the role/position as the role field
- Separate lenses from camera bodies — if "Sony A7SIII with 24-70mm" is mentioned, create a camera entry with that lens
- For must-have moments or shot lists, create individual shot entries
- Detect project type from context (live_event for concerts, commercial for ads, etc.)
- If something is unclear, use null rather than guessing
- Keep descriptions concise but complete`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const planError = await requireActivePlan(supabase, user.id);
    if (planError) return planError;
    if (await isRateLimited(`ai:import-brief:${user.id}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const contentType = req.headers.get("content-type") ?? "";

    let messageContent: Anthropic.MessageParam["content"];

    if (contentType.includes("application/json")) {
      // Plain text / pasted brief
      const { text } = await req.json();
      if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });
      messageContent = `Here is the production brief to analyze:\n\n${text}`;
    } else if (contentType.includes("multipart/form-data")) {
      // PDF upload
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type as "application/pdf";

      messageContent = [
        {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: mimeType,
            data: base64,
          },
        },
        {
          type: "text" as const,
          text: "Please analyze this production brief and extract all structured data.",
        },
      ];
    } else {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: messageContent }],
    });

    const raw = response.content[0];
    if (raw.type !== "text") return NextResponse.json({ error: "Unexpected response" }, { status: 500 });

    // Strip any accidental markdown fences
    const cleaned = raw.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: cleaned }, { status: 500 });
    }

    return NextResponse.json({ result: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
