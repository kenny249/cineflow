import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const { text, action } = await req.json() as { text: string; action: ActionKey };
  if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });
  if (!ACTIONS[action]) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const instruction = ACTIONS[action];

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
