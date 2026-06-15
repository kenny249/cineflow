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
    if (await isRateLimited(`ai:quote-scope:${user.id}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const rawBody = await req.json();
    if (JSON.stringify(rawBody).length > 50_000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const { brief, title, lineItems, selectedTier, tierAmount } = rawBody;

    const servicesList = (lineItems as Array<{ service: string; people: number; days: number; rate: number; isFlat: boolean }>)
      .filter((li) => li.service?.trim())
      .map((li) => {
        const total = li.isFlat ? li.rate : li.people * li.days * li.rate;
        return `- ${li.service} (${li.isFlat ? "flat fee" : `${li.people} person${li.people !== 1 ? "s" : ""}, ${li.days} day${li.days !== 1 ? "s" : ""}`})`;
      })
      .join("\n");

    const tierLabel = selectedTier === "floor" ? "Essential" : selectedTier === "standard" ? "Standard" : "Premium";
    const amountFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(tierAmount);

    const prompt = `You are a professional production agency writer helping create polished, client-facing quote copy.

Estimate title: ${title}
Project brief: ${brief || "Not specified — infer from the services listed"}
Services included:
${servicesList || "No services listed yet"}
Selected tier: ${tierLabel} at ${amountFormatted}

Write professional client-facing copy for this production quote. Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Professional quote title (5-8 words, specific to this project — NOT generic)",
  "description": "One crisp line under 12 words — what the client is getting",
  "scope_of_work": "2-4 professional sentences describing what will be delivered and produced. Client-facing language only. No mention of rates, costs, markup, or internal terms. Focus on deliverables, quality, and experience."
}`;

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
