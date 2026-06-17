import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { pdfBase64 } = body;
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return NextResponse.json({ error: "Missing pdfBase64" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client.messages.create as any)({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: `You are analyzing a video production brief for a retainer client. Extract every video that needs to be produced.

Rules for titles:
- Write them as a natural, human-sounding title — NOT "Video 1: The..." format
- Think like a creative director naming a piece, not a project manager
- Examples: "The Friendly Adjuster Trap" not "Insurance Adjuster Video", "Why Most Claims Fail" not "Claims Failure Explainer"
- Keep titles concise (3–7 words is ideal)

For each video return:
- title: Human-sounding, simple title (see rules above)
- description: 1–2 sentences on what the video is about
- key_message: The core takeaway or goal
- call_to_action: What viewers should do after watching (if mentioned)
- duration: Approximate length if specified (e.g. "60–90 seconds")
- notes: Specific tone, style, or technical requirements from the brief

Respond ONLY with a valid JSON array. No other text before or after.

[
  {
    "title": "...",
    "description": "...",
    "key_message": "...",
    "call_to_action": "...",
    "duration": "...",
    "notes": "..."
  }
]`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not extract video list from brief" }, { status: 422 });
    }

    const videos = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(videos)) {
      return NextResponse.json({ error: "Invalid response format" }, { status: 422 });
    }

    return NextResponse.json({ videos });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Parse error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
