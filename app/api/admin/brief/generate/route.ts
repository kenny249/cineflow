import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminPage } from "@/lib/admin-guard";
import { BRIEF } from "@/lib/brief.config";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const FORMATS = {
  ig: {
    label: "Instagram Caption",
    instructions: "Write an Instagram caption for CineFlow. Max 2200 characters. Start with a strong hook line, then 3-4 bullet points on key benefits, end with a CTA and relevant hashtags. Conversational, filmmaker-to-filmmaker tone. No corporate speak.",
  },
  sms: {
    label: "SMS / Text",
    instructions: "Write a text message someone could send to recommend CineFlow to a filmmaker friend. Max 3 sentences, ~160 chars ideally. Casual and direct. Lead with the value prop.",
  },
  email: {
    label: "Email Pitch",
    instructions: "Write a professional but warm email introducing CineFlow to a potential investor or partner. 3-4 paragraphs: hook, problem, solution + key metrics, call to action. Subject line included at the top (prefix with 'Subject: '). No fluff.",
  },
  pitch: {
    label: "Full Pitch",
    instructions: "Write a comprehensive company overview / pitch narrative for investors or new team members. Cover: what CineFlow is, the problem, the solution, key features, market opportunity, pricing, competitive advantage, and vision. 600-900 words. Professional but authentic voice.",
  },
};

export async function POST(req: NextRequest) {
  try {
    await requireAdminPage();

    const body = await req.json();
    const { format } = body;
    if (!FORMATS[format as keyof typeof FORMATS]) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    const fmt = FORMATS[format as keyof typeof FORMATS];

    const context = `
CineFlow Company Data:
- Mission: ${BRIEF.company.mission}
- Tagline: ${BRIEF.company.tagline}
- Stage: ${BRIEF.company.stage}
- Target user: ${BRIEF.company.targetUser}

Key features (${BRIEF.features.length} total): ${BRIEF.features.map(f => f.name).join(", ")}

Pricing: ${BRIEF.pricing.tiers.map(t => `${t.name} $${t.price}/mo`).join(", ")}. Lifetime: $${BRIEF.pricing.lifetime.price} one-time.

Competitor savings: Replaces Frame.io, StudioBinder, DocuSign, FreshBooks, Notion — saves filmmakers $${BRIEF.roi.monthlySavings}/mo ($${BRIEF.roi.annualSavings}/yr).

Market: ${BRIEF.market.target.value} target users. ${BRIEF.market.tam.value} TAM growing ${BRIEF.market.tam.growth}.

Problem: ${BRIEF.problem.points.map(p => `${p.stat} ${p.label}`).join("; ")}.

Key differentiators: AI-powered tools built-in, all-in-one (no integrations needed), purpose-built for filmmakers, lifetime deal available.
`.trim();

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [{ role: "user", content: `${context}\n\n${fmt.instructions}` }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ text, label: fmt.label });
  } catch (err: any) {
    console.error("[brief/generate]", err);
    return NextResponse.json({ error: err.message ?? "Generation failed" }, { status: 500 });
  }
}
