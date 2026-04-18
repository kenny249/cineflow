import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, system } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: system ?? `You are a creative director and cinematographer assistant inside CineFlow, a professional video production management platform. You help filmmakers and production teams build compelling storyboards.

When asked to generate storyboard frames, respond ONLY with a JSON array in this exact format:
[
  {
    "title": "Frame title",
    "description": "Detailed visual description of what's in the frame",
    "shot_type": "wide|medium|close_up|extreme_close_up|overhead|drone|pov",
    "camera_angle": "e.g. Wide / Eye level",
    "shot_duration": "00:00:05",
    "mood": "e.g. Tense, Golden, Moody",
    "notes": "Director notes, lighting cues, etc."
  }
]

For general chat, be concise, creative, and cinematically focused. Reference real filmmaking techniques, directors, and visual styles when relevant.`,
      messages,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
    }

    return NextResponse.json({ text: content.text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Claude error" }, { status: 500 });
  }
}
