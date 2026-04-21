import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project, shotItems, crew, locations, formData } = await req.json();

  const totalShots = shotItems?.length ?? 0;
  const locationNames = (locations ?? []).map((l: any) => l.name).join(", ");

  const prompt = `You are a professional film production coordinator. Generate a realistic shooting schedule for this call sheet.

PROJECT: ${project.title}
CLIENT: ${project.client_name || "TBD"}
SHOOT DATE: ${formData.shootDate}
GENERAL CALL TIME: ${formData.callTime}
WRAP TIME: ${formData.wrapTime}

LOCATIONS (${locations?.length ?? 0}):
${(locations ?? []).map((l: any, i: number) => `${i + 1}. ${l.name}${l.address ? ` — ${l.address}` : ""}`).join("\n") || "No locations specified"}

CREW (${crew?.length ?? 0} people):
${(crew ?? []).map((c: any) => `- ${c.role}: ${c.name}`).join("\n") || "No crew listed"}

SHOT LIST (${totalShots} shots):
${totalShots > 0
  ? (shotItems ?? []).map((s: any) =>
      `Shot ${s.shot_number}: ${s.description} [${s.shot_type?.replace(/_/g, " ")}]${s.location ? ` @ ${s.location}` : ""}${s.camera_movement && s.camera_movement !== "static" ? ` — ${s.camera_movement}` : ""}${s.notes ? ` (${s.notes})` : ""}`
    ).join("\n")
  : "No shots listed — generate a generic production schedule based on crew call and wrap time."}

RULES:
- Group shots by location to minimize company moves
- Allow 20-30 min crew setup before first shot each location
- Allow 10-15 min between shots for camera/lighting adjustments
- Allow 45 min for a company move between locations
- Add a 30-min lunch break if shoot is 6+ hours
- Add a morning coffee/briefing block after crew call
- Use 24h time format (07:00, 13:30)
- Be realistic — if there are too many shots for the time window, note it in "warning"
- End with a wrap/strike block before wrap time

Return ONLY valid JSON in this exact shape, no markdown, no explanation:
{
  "schedule": [
    { "time": "07:00", "label": "Crew Call / Basecamp Setup", "location": null, "type": "logistics" },
    { "time": "07:15", "label": "Morning briefing & coffee", "location": null, "type": "logistics" },
    { "time": "07:30", "label": "Camera & Lighting Setup", "location": "${locationNames || "Location A"}", "type": "setup" },
    { "time": "08:30", "label": "Shot 1: Description here", "location": "${locationNames || "Location A"}", "type": "shoot" }
  ],
  "warning": null
}

Valid types: "logistics" | "setup" | "shoot" | "break" | "move" | "wrap"`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Failed to parse schedule" }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Generation failed" }, { status: 500 });
  }
}
