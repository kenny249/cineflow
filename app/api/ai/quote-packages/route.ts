import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActivePlan } from "@/lib/billing-server";
import { isRateLimited } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const planError = await requireActivePlan(supabase, user.id);
    if (planError) return planError;
    if (await isRateLimited(`ai:quote-packages:${user.id}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const rawBody = await req.json();
    if (JSON.stringify(rawBody).length > 50_000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const { brief, lineItems, tierAmount } = rawBody;

    const servicesList = (lineItems as Array<{ description: string; quantity: string; rate: string }>)
      .filter((li) => li.description?.trim())
      .map((li) => `- ${li.description}: qty ${li.quantity} @ $${li.rate}`)
      .join("\n");

    const amountFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(tierAmount || 0);

    const prompt = `You are a senior production agency consultant creating tiered quote packages for a client proposal.

Project brief: ${brief || "Video production project"}
Reference line items:
${servicesList || "No specific line items provided — infer appropriate production services from the brief"}
Reference total (Standard tier target): ${amountFormatted}

Create exactly 3 tiers with GENUINELY DIFFERENT scope — not just the same services at different prices. Each tier should reflect a meaningfully different production approach. Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "name": "Essential",
    "description": "1-2 sentences, client-facing, what they get at this tier",
    "line_items": [
      { "description": "Service name", "quantity": "1", "rate": "0" }
    ]
  },
  {
    "name": "Standard",
    "description": "1-2 sentences, client-facing, what they get at this tier",
    "line_items": [
      { "description": "Service name", "quantity": "1", "rate": "0" }
    ]
  },
  {
    "name": "Premium",
    "description": "1-2 sentences, client-facing, what they get at this tier",
    "line_items": [
      { "description": "Service name", "quantity": "1", "rate": "0" }
    ]
  }
]

Tier rules — scope MUST differ, not just price:
- Essential (~60-65% of reference total): Stripped-down scope. Fewer shoot days, smaller crew, core deliverables only. No extras. A client with a tight budget gets the job done.
- Standard (~100% of reference total): Full scope as briefed. Complete crew, full production days, all key deliverables. This is the recommended choice for most clients.
- Premium (~145-155% of reference total): Elevated production. Larger crew, extra shoot day, additional deliverables (e.g. social cut, BTS, additional edits), faster turnaround, or higher-end treatment. Justify every extra dollar with real added value.

Output rules:
- Use specific, realistic production line item names (e.g. "DP — 2 Day Shoot" not "Videographer")
- Quantities reflect actual units: shoot days, edit days, number of deliverables, etc.
- Rates are round numbers in USD
- Descriptions are polished, client-facing — no internal jargon, no mention of costs or markups
- Line item counts should reflect scope: Essential has fewer items than Standard, Standard fewer than Premium`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");

    const packages = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ packages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
