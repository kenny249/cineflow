import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function to12h(t: string): string {
  if (!t || !t.includes(":")) return t || "TBD";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function scriptedPrompt(project: any, shotItems: any[], crew: any[], locations: any[], formData: any): string {
  const locationNames = (locations ?? []).map((l: any) => l.name).join(", ");
  const totalShots = shotItems?.length ?? 0;
  return `You are a professional film production coordinator. Generate a realistic shooting schedule.

PROJECT: ${project.title}
FORMAT: ${formData.format === "interview" ? "Interview / Documentary" : "Scripted Production"}
CLIENT: ${project.client_name || "TBD"}
SHOOT DATE: ${formData.shootDate || "TBD"}
CALL TIME: ${to12h(formData.callTime)}
WRAP TIME: ${to12h(formData.wrapTime)}

LOCATIONS:
${(locations ?? []).map((l: any, i: number) => `${i + 1}. ${l.name}${l.address ? ` — ${l.address}` : ""}`).join("\n") || "No locations specified"}

CREW (${crew?.length ?? 0}):
${(crew ?? []).map((c: any) => `- ${c.role}: ${c.name} (call: ${to12h(c.callTime || formData.callTime)})`).join("\n") || "No crew listed"}

SHOT LIST (${totalShots} shots):
${totalShots > 0
  ? (shotItems ?? []).slice(0, 30).map((s: any) =>
      `Shot ${s.shot_number}: ${s.description} [${s.shot_type?.replace(/_/g, " ")}]${s.location ? ` @ ${s.location}` : ""}${s.notes ? ` (${s.notes})` : ""}`
    ).join("\n")
  : "No shots — generate a generic schedule based on crew call and wrap time."}

RULES:
- Group shots by location to minimize company moves
- Allow 20-30 min setup before first shot at each location
- Allow 10-15 min between shots for adjustments
- Allow 45 min for a company move between locations
- Add a 30-min lunch break if shoot is 6+ hours
- Add a morning briefing block after crew call
- Use 12-hour time format (9:00 AM, 1:30 PM) — NOT 24h format
- If too many shots for the window, note it in "warning"
- End with wrap/strike before wrap time

Return ONLY valid JSON:
{
  "format": "scripted",
  "schedule": [
    { "time": "9:00 AM", "label": "Crew Call / Basecamp Setup", "location": null, "type": "logistics" },
    { "time": "9:30 AM", "label": "Camera & Lighting Setup", "location": "${locationNames || "Location A"}", "type": "setup" },
    { "time": "10:30 AM", "label": "Shot 1: Description", "location": "${locationNames || "Location A"}", "type": "shoot" }
  ],
  "warning": null
}

Valid types: "logistics" | "setup" | "shoot" | "break" | "move" | "wrap"`;
}

function liveEventPrompt(project: any, shotItems: any[], crew: any[], locations: any[], formData: any): string {
  return `You are a professional live event production coordinator. Generate a coverage-based call sheet for a live event or concert where multiple cameras roll simultaneously — NOT a sequential time-blocked schedule.

PROJECT: ${project.title}
CLIENT: ${project.client_name || "TBD"}
VENUE: ${(locations ?? []).map((l: any) => l.name).join(", ") || "TBD"}
DATE: ${formData.shootDate || "TBD"}
DOORS / CALL: ${to12h(formData.callTime)}
WRAP: ${to12h(formData.wrapTime)}

CREW (${crew?.length ?? 0}):
${(crew ?? []).map((c: any) => `- ${c.name}: ${c.role} (dept: ${c.department || "Camera"}, call: ${to12h(c.callTime || formData.callTime)})`).join("\n") || "No crew listed"}

MUST-HAVE MOMENTS / SHOT LIST (${shotItems?.length ?? 0}):
${(shotItems ?? []).slice(0, 40).map((s: any) => `- ${s.description}${s.notes ? ` [${s.notes}]` : ""}`).join("\n") || "General multi-cam live event coverage"}

Return ONLY valid JSON:
{
  "format": "live_event",
  "coverage": [
    {
      "person": "Person name",
      "role": "Coverage role title",
      "equipment": "Camera / equipment they are using",
      "responsibilities": [
        "Specific coverage responsibility — what they shoot all night",
        "Any special moments assigned to them"
      ]
    }
  ],
  "staticCameras": [
    {
      "name": "Camera name (e.g. Mounted Artist Camera)",
      "role": "Position and purpose (e.g. Behind artist — continuous safety angle, no operator needed)"
    }
  ],
  "keyMoments": [
    {
      "label": "Short moment name (e.g. Walk to Stage)",
      "description": "Who covers it and how (e.g. Sam covers on iPhone, Aly + Kenny move to stage positions)",
      "type": "pre"
    }
  ],
  "warning": null
}

Rules:
- Each crew member with a camera gets their own coverage entry
- Static/mounted cameras WITHOUT a dedicated operator go in staticCameras, not coverage
- Key moments go in rough chronological order: pre-show → during show → post-show
- moment type: "pre" = before show, "during" = live performance, "post" = after show, "logistics" = crew logistics
- Be specific — name the person responsible for each key moment
- Only include people and cameras actually listed in the crew/shot list above`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project, shotItems, crew, locations, formData } = await req.json();
  const format: string = formData?.format ?? "scripted";

  const prompt = format === "live_event"
    ? liveEventPrompt(project, shotItems, crew, locations, formData)
    : scriptedPrompt(project, shotItems, crew, locations, formData);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]);
    if (!result.format) result.format = format;

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Generation failed" }, { status: 500 });
  }
}
