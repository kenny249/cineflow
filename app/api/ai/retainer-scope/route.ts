import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActivePlan } from "@/lib/billing-server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const planError = await requireActivePlan(supabase, user.id);
    if (planError) return planError;

    const rawBody = await req.json();
    if (JSON.stringify(rawBody).length > 50_000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const { brief } = rawBody;

    const prompt = `You are a senior production agency consultant structuring a monthly retainer proposal.

Client brief: ${brief || "Monthly video production retainer"}

Generate a realistic, professional retainer structure. Return ONLY valid JSON (no markdown, no explanation):
{
  "monthly_rate": "3500",
  "retainer_months": "3",
  "scope_of_work": "2-3 professional sentences describing what will be delivered each month. Client-facing language. Focus on ongoing value and consistency.",
  "retainer_deliverables": [
    { "label": "Reels (15-30s)", "quantity": "4" },
    { "label": "Photo session", "quantity": "1" }
  ]
}

Rules:
- monthly_rate: realistic USD number as a string (no $ symbol). Base on industry rates for the described scope and volume.
- retainer_months: typical commitment — 3 for small brands, 6 for mid-tier, 12 for enterprise. Match the brief.
- scope_of_work: professional and client-facing. No costs, no internal terms. Lead with what the client receives each month.
- retainer_deliverables: 3-6 specific, named deliverables with realistic monthly quantities. Use specific names (e.g. "Instagram Reels (30-60s)" not "Videos"). Quantities should be achievable at the implied monthly rate.
- All fields are strings.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
