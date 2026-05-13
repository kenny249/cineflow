import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { brief, lineItems, tierAmount } = await req.json();

    const servicesList = (lineItems as Array<{ description: string; quantity: string; rate: string }>)
      .filter((li) => li.description?.trim())
      .map((li) => `- ${li.description}: qty ${li.quantity} @ $${li.rate}`)
      .join("\n");

    const amountFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(tierAmount || 0);

    const prompt = `You are a production agency consultant creating tiered quote packages for a client proposal.

Project brief: ${brief || "Video production project"}
Reference line items:
${servicesList || "No specific line items"}
Reference total: ${amountFormatted}

Create exactly 3 production quote packages. Return ONLY valid JSON array (no markdown, no explanation):
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

Rules:
- Essential: ~65% of reference total. Lean scope, core deliverables only.
- Standard: ~100% of reference total. Full scope as briefed. This is the recommended tier.
- Premium: ~150% of reference total. Expanded scope, added value, faster turnaround or more deliverables.
- Use realistic production line item names (not generic).
- Rates should be round numbers. Quantities should reflect the scope (days, units, etc.).
- Keep descriptions professional and client-facing — no internal jargon.`;

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
