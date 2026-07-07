import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Prompts per template type ─────────────────────────────────────────────────

function buildPrompt(templateId: string, fields: Record<string, string>, studioName: string): string {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const shared = `You are a professional legal document writer specializing in the film and media production industry.
Write clear, professional, legally sound contract language. Use plain English — avoid excessive legalese but maintain enforceability.
Tailor every clause to film/media production context. Return ONLY valid JSON, no markdown, no explanation.

Today's date: ${today}
Studio name: ${studioName}
`;

  const outputFormat = `Return JSON:
{
  "sections": [
    { "title": "1. Section Name", "body": "Full section text as a single string. Write complete, professional paragraphs." },
    ...
  ]
}
Each section body should be 2-5 sentences. Write 8-12 sections covering the complete agreement.`;

  switch (templateId) {
    case "production_agreement":
      return `${shared}
Contract type: Client Production Agreement
Client: ${fields.recipientName}
Project: ${fields.projectName || "Video production services"}
Project description: ${fields.projectDescription || "Professional video production"}
Total fee: ${fields.totalFee ? `$${fields.totalFee}` : "As agreed"}
Payment schedule: ${fields.paymentSchedule || "50% upfront, 50% on delivery"}
Deliverables: ${fields.deliverables || "Final edited video files"}
Revision rounds: ${fields.revisionRounds || "2 rounds"}
Usage rights: ${fields.usageRights || "Online and social media use"}
Start date: ${fields.startDate || "Upon signing"}
Delivery date: ${fields.deliveryDate || "As agreed"}

Write a complete Client Production Agreement between ${studioName} ("Studio") and ${fields.recipientName} ("Client").
Include sections covering: Services/Scope of Work, Deliverables, Payment Terms, Revision Policy, Intellectual Property & Usage Rights, Credit, Client Responsibilities, Cancellation & Rescheduling, Limitation of Liability, Confidentiality, and Governing Law.
Make payment terms and deliverables match exactly what was specified above.

${outputFormat}`;

    case "talent_release":
      return `${shared}
Contract type: Talent / Actor Release
Talent name: ${fields.recipientName}
Production title: ${fields.productionTitle || "Production"}
Platforms: ${fields.platforms || "Online, social media, broadcast"}
Compensation: ${fields.compensation || "As agreed"}
Exclusivity: ${fields.exclusivity === "yes" ? "Exclusive — talent may not appear in competing productions during the term" : "Non-exclusive"}
Term: ${fields.term || "In perpetuity"}

Write a complete Talent Release Agreement between ${studioName} ("Production Company") and ${fields.recipientName} ("Talent").
Include sections covering: Grant of Rights, Description of Production, Compensation, Exclusivity, Representations & Warranties, Indemnification, Moral Rights Waiver, Credit, and Governing Law.
Be specific about the platforms and usage rights granted.

${outputFormat}`;

    case "location_release":
      return `${shared}
Contract type: Location Release Agreement
Location owner: ${fields.recipientName}
Location name/address: ${fields.locationName || "the property"}
Shoot dates: ${fields.shootDates || "As scheduled"}
Crew size: ${fields.crewSize || "Production crew"}
Fee/compensation: ${fields.fee || "Complimentary / as agreed"}
Restoration required: ${fields.restoration !== "no" ? "Yes — crew must restore property to original condition" : "Standard care only"}

Write a complete Location Release Agreement between ${fields.recipientName} ("Owner") and ${studioName} ("Production Company").
Include sections covering: Grant of License, Shoot Schedule, Access & Crew Conduct, Compensation, Equipment & Vehicles, Restoration Obligations, Insurance & Liability, Indemnification, and Governing Law.

${outputFormat}`;

    case "nda":
      return `${shared}
Contract type: Non-Disclosure Agreement
Other party: ${fields.recipientName}
NDA type: ${fields.ndaType === "mutual" ? "Mutual (both parties protect each other's information)" : "One-way (only the recipient is bound)"}
Confidential information covers: ${fields.confidentialInfo || "project details, creative concepts, business information, client data, and proprietary methods"}
Term: ${fields.term || "2 years from signing"}

Write a complete Non-Disclosure Agreement between ${studioName} ("Disclosing Party") and ${fields.recipientName} ("Receiving Party").
${fields.ndaType === "mutual" ? "This is mutual — both parties share and protect confidential information." : "This is one-directional — only the Receiving Party is bound."}
Include sections covering: Definition of Confidential Information, Obligations of Receiving Party, Exclusions from Confidentiality, Term & Termination, Return of Materials, Remedies & Injunctive Relief, No License Granted, and Governing Law.

${outputFormat}`;

    case "crew_deal_memo":
      return `${shared}
Contract type: Crew Deal Memo
Crew member: ${fields.recipientName}
Role/position: ${fields.role || "Crew member"}
Day rate: ${fields.dayRate ? `$${fields.dayRate} per day` : "As agreed"}
Shoot dates: ${fields.shootDates || "As scheduled"}
Kit/equipment fee: ${fields.kitFee ? `$${fields.kitFee} per day` : "None"}
Overtime rule: ${fields.overtimeRule || "After 10 hours"}
Travel/expenses: ${fields.travel || "As agreed"}

Write a complete Crew Deal Memo / Freelance Engagement Agreement between ${studioName} ("Production Company") and ${fields.recipientName} ("Crew Member") for the role of ${fields.role || "crew member"}.
Include sections covering: Engagement & Role, Compensation & Day Rate, Kit Fee, Work Schedule & Overtime, Work-for-Hire & Intellectual Property, Confidentiality, Equipment Responsibility, Independent Contractor Status, and Governing Law.
The work-for-hire clause should assign all footage, content, and deliverables to the Production Company.

${outputFormat}`;

    case "music_license":
      return `${shared}
Contract type: Music Synchronization License
Licensor (musician/label): ${fields.recipientName}
Track title: ${fields.trackTitle || "the musical composition"}
Artist: ${fields.artist || fields.recipientName}
Usage platforms: ${fields.platforms || "Online, social media"}
Territory: ${fields.territory || "Worldwide"}
License term: ${fields.term || "In perpetuity"}
Fee: ${fields.fee || "As agreed"}
Exclusivity: ${fields.exclusivity === "yes" ? "Exclusive sync license for this production" : "Non-exclusive"}

Write a complete Music Synchronization License Agreement between ${fields.recipientName} ("Licensor") and ${studioName} ("Licensee").
Include sections covering: Grant of License, Track Description, Permitted Use, Territory & Term, Fee, Licensor Warranties, Credit, Exclusivity, Moral Rights, and Governing Law.

${outputFormat}`;

    case "model_release":
      return `${shared}
Contract type: Model Release
Model: ${fields.recipientName}
Production/campaign: ${fields.productionTitle || "the production"}
Usage type: ${fields.usageType || "Commercial and promotional"}
Platforms: ${fields.platforms || "Online, social media, print, broadcast"}
Compensation: ${fields.compensation || "As agreed"}
Alterations permitted: ${fields.alterations !== "no" ? "Yes — including digital editing, cropping, color grading" : "Limited — no significant alterations without consent"}

Write a complete Model Release Agreement between ${studioName} ("Photographer/Producer") and ${fields.recipientName} ("Model").
Include sections covering: Grant of Rights, Description of Production, Usage & Platforms, Compensation, Right to Alter Images, Credit, Representations & Warranties, Indemnification, and Governing Law.

${outputFormat}`;

    default:
      return `${shared}
Contract type: General Agreement
Other party: ${fields.recipientName}
Subject: ${fields.projectName || "Services"}
Terms: ${fields.description || "As discussed between the parties"}

Write a general service agreement between ${studioName} ("Service Provider") and ${fields.recipientName} ("Client").
Include standard sections: Scope of Services, Compensation, Term, Confidentiality, Intellectual Property, Limitation of Liability, Termination, and Governing Law.

${outputFormat}`;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (await isRateLimited(`ai:contract-generate:${user.id}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests. Please wait before generating another contract." }, { status: 429 });
    }

    const body = await req.json();
    const { templateId, fields, studioName } = body as {
      templateId: string;
      fields: Record<string, string>;
      studioName: string;
    };

    if (!templateId || !fields || !studioName) {
      return NextResponse.json({ error: "templateId, fields, and studioName are required" }, { status: 400 });
    }
    if (!fields.recipientName?.trim()) {
      return NextResponse.json({ error: "Recipient name is required" }, { status: 400 });
    }

    const prompt = buildPrompt(templateId, fields, studioName);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to generate contract — please try again.");

    const result = JSON.parse(jsonMatch[0]) as { sections: { title: string; body: string }[] };
    if (!Array.isArray(result.sections) || result.sections.length === 0) {
      throw new Error("Contract generation returned no sections.");
    }

    return NextResponse.json({ sections: result.sections });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate contract";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
