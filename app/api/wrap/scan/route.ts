import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image, mimeType } = await req.json();
  if (!image) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const type = validTypes.includes(mimeType) ? mimeType : "image/jpeg";

  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: image },
          },
          {
            type: "text",
            text: `You are a receipt parser. Extract the following from this receipt image and respond ONLY with a valid JSON object — no markdown, no explanation:
{
  "vendor": "business name",
  "amount": 12.50,
  "date": "2024-06-01",
  "category": "food|travel|accommodation|equipment|other",
  "description": "brief description of what was purchased"
}

Rules:
- amount must be a number (no currency symbols), or null if unclear
- date must be ISO format YYYY-MM-DD, or empty string if unclear
- category must be exactly one of: food, travel, accommodation, equipment, other
- If you cannot read the receipt clearly, make your best guess`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  try {
    // Strip any markdown fences if Claude added them
    const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({
      vendor:      String(parsed.vendor ?? ""),
      amount:      parsed.amount != null ? Number(parsed.amount) : null,
      date:        String(parsed.date ?? ""),
      category:    String(parsed.category ?? "other"),
      description: String(parsed.description ?? ""),
    });
  } catch {
    return NextResponse.json({ error: "Could not parse receipt — try a clearer photo." }, { status: 422 });
  }
}
