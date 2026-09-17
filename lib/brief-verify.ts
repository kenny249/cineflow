import Anthropic from "@anthropic-ai/sdk";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Every data point the Brief's ROI/market sections need re-verified against
// the live web, and which static fallback (lib/brief.config.ts) each maps to.
const RESEARCH_TARGETS = [
  { key: "frameio_price", label: "Frame.io", ask: "the cheapest real paid individual/solo plan (not the free tier, not the team/enterprise tier) — as of today" },
  { key: "studiobinder_price", label: "StudioBinder", ask: "the Indie plan (StudioBinder's entry-level paid plan for a solo filmmaker) — as of today" },
  { key: "docusign_hellosign_price", label: "DocuSign / HelloSign (Dropbox Sign)", ask: "the cheapest real paid single-user plan for EACH of DocuSign and Dropbox Sign (formerly HelloSign), then report whichever is cheaper as the representative price" },
  { key: "wave_freshbooks_price", label: "Wave / FreshBooks", ask: "the cheapest real PAID plan for EACH of Wave and FreshBooks (ignore Wave's free tier — we need what a filmmaker actually pays for automated invoicing), then report whichever is cheaper as the representative price" },
  { key: "notion_price", label: "Notion", ask: "the Plus plan, monthly billing (not annual) — as of today" },
  { key: "wipster_price", label: "Wipster", ask: "the Team plan, per-seat monthly price — as of today" },
  { key: "market_tam", label: "Global video production software market size (TAM)", ask: "the most recent credible market-research estimate of total market size and its growth rate (CAGR)" },
  { key: "market_sam", label: "Freelance & independent production company software segment (SAM)", ask: "the most recent credible estimate of this specific serviceable segment" },
] as const;

const REPORT_TOOL: Anthropic.Tool = {
  name: "report_verified_data",
  description: "Report the final verified value for every researched item. Call this exactly once, after you've searched for all items.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "Must match one of the requested keys exactly." },
            value_display: { type: "string", description: "Short human-readable value, e.g. \"$15/mo\" or \"$6.9B\"." },
            value_number: { type: "number", description: "The plain numeric form — monthly USD price, or the dollar value in a consistent unit (e.g. billions) for market figures. Omit if genuinely not a single number." },
            source_url: { type: "string", description: "The exact URL of the page that stated this figure." },
            source_title: { type: "string", description: "The page or publication title." },
            note: { type: "string", description: "One short sentence of context, e.g. which plan tier, or how the figure was derived." },
          },
          required: ["key", "value_display", "source_url"],
        },
      },
    },
    required: ["items"],
  },
};

export type BriefVerifyResult = {
  ok: boolean;
  updated: number;
  items?: { key: string; value_display: string }[];
  error?: string;
};

export async function runBriefVerification(): Promise<BriefVerifyResult> {
  const targetList = RESEARCH_TARGETS.map((t) => `- key: "${t.key}" — ${t.label}: look up ${t.ask}.`).join("\n");

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `You are refreshing the live pricing/market data shown in CineFlow's investor-facing Company Brief. Use web search to look up the CURRENT, real price or figure for each item below — actual numbers as published today, not estimates or memory. Prefer each company's own pricing page; fall back to a recent, reputable secondary source only if the primary page isn't fetchable, and say so in "note".

${targetList}

Search for each item, then call report_verified_data exactly once with all ${RESEARCH_TARGETS.length} items.`,
    },
  ];

  for (let round = 0; round < 6; round++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 20 },
        REPORT_TOOL,
      ],
      messages,
    });

    const reportCall = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_verified_data"
    );

    if (reportCall) {
      const items = (reportCall.input as { items?: any[] }).items ?? [];
      const admin = getAdmin();
      let updated = 0;
      for (const item of items) {
        if (!item.key || !item.value_display || !item.source_url) continue;
        const target = RESEARCH_TARGETS.find((t) => t.key === item.key);
        const { error } = await admin.from("brief_data_points").upsert({
          key: item.key,
          label: target?.label ?? item.key,
          value_display: String(item.value_display),
          value_number: typeof item.value_number === "number" ? item.value_number : null,
          source_url: String(item.source_url),
          source_title: item.source_title ? String(item.source_title) : null,
          note: item.note ? String(item.note) : null,
          verified_at: new Date().toISOString(),
        }, { onConflict: "key" });
        if (!error) updated++;
      }
      return { ok: true, updated, items: items.map((i) => ({ key: i.key, value_display: i.value_display })) };
    }

    if (response.stop_reason === "refusal") {
      return { ok: false, updated: 0, error: "Model declined the request (refusal)." };
    }

    if (response.stop_reason !== "tool_use") {
      // Model finished without calling the report tool — nothing to save.
      return { ok: false, updated: 0, error: "Model did not report structured results." };
    }

    // Still mid-research (server-executed web_search already ran) — continue the loop
    // only if there's a genuine client-side tool call pending; web_search itself
    // needs no manual execution, so just re-send and let Claude keep searching.
    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: response.content });
    if (toolUseBlocks.length === 0) {
      // No client tool calls (pure server-side search happened) — nudge it to continue.
      messages.push({ role: "user", content: "Continue researching the remaining items, then call report_verified_data." });
    } else {
      messages.push({
        role: "user",
        content: toolUseBlocks.map((t) => ({ type: "tool_result" as const, tool_use_id: t.id, content: "acknowledged" })),
      });
    }
  }

  return { ok: false, updated: 0, error: "Exceeded round limit without a final report." };
}
