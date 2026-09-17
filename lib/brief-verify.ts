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

type ResearchTarget = (typeof RESEARCH_TARGETS)[number];

const REPORT_TOOL: Anthropic.Tool = {
  name: "report_verified_value",
  description: "Report the final verified value for this one item. Call this exactly once, after you've searched.",
  input_schema: {
    type: "object" as const,
    properties: {
      value_display: { type: "string", description: "Short human-readable value, e.g. \"$15/mo\" or \"$6.9B\"." },
      value_number: { type: "number", description: "The plain numeric form — monthly USD price, or the dollar value in a consistent unit (e.g. billions) for market figures. Omit if genuinely not a single number." },
      source_url: { type: "string", description: "The exact URL of the page that stated this figure." },
      source_title: { type: "string", description: "The page or publication title." },
      note: { type: "string", description: "One short sentence of context, e.g. which plan tier, or how the figure was derived." },
    },
    required: ["value_display", "source_url"],
  },
};

type ReportedItem = {
  value_display: string;
  value_number?: number;
  source_url: string;
  source_title?: string;
  note?: string;
};

// Hard ceiling on a single item's total research time. Live-tested: even
// with each item individually capped at a few searches and 3 rounds, one
// slow/contended item (in practice, likely the two-company comparisons —
// "DocuSign vs HelloSign", "Wave vs FreshBooks") blocked the entire parallel
// batch past 90s, then 150s, with no per-item bound to fall back on. This
// guarantees no single item can hold up the others, regardless of why it's
// slow (rate-limit contention, retries, an indecisive multi-source compare).
// Verified locally: 8 concurrent items genuinely contend with each other —
// at a 30s cap only 4/8 finished in time. A failed item just keeps its
// previous value until the next run (weekly cron + on-demand), so this is
// an acceptable, self-healing tradeoff rather than a bug to fully solve.
const PER_ITEM_TIMEOUT_MS = 40_000;
// Per-call SDK timeout so one stuck HTTP request can't itself outlast the
// item-level deadline above.
const PER_CALL_TIMEOUT_MS = 20_000;

async function researchOneInner(target: ResearchTarget): Promise<ReportedItem | null> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Look up the CURRENT, real price or figure for ${target.label}. Specifically: ${target.ask}. Use web search — prefer the company's own pricing page; fall back to a recent, reputable secondary source only if that page isn't fetchable, and say so in "note". Then call report_verified_value exactly once with the result.`,
    },
  ];

  for (let round = 0; round < 3; round++) {
    const response = await anthropic.messages.create(
      {
        model: "claude-sonnet-5",
        max_tokens: 1024,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 4 },
          REPORT_TOOL,
        ],
        messages,
      },
      { timeout: PER_CALL_TIMEOUT_MS }
    );

    const reportCall = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_verified_value"
    );
    if (reportCall) return reportCall.input as ReportedItem;

    if (response.stop_reason === "refusal" || response.stop_reason !== "tool_use") return null;

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: response.content });
    if (toolUseBlocks.length === 0) {
      messages.push({ role: "user", content: "Continue researching, then call report_verified_value." });
    } else {
      messages.push({
        role: "user",
        content: toolUseBlocks.map((t) => ({ type: "tool_result" as const, tool_use_id: t.id, content: "acknowledged" })),
      });
    }
  }
  return null;
}

// One small, bounded request per item — a handful of searches at most, not a
// single giant request researching all 8 items sequentially. That older
// design could run for many minutes with no way to bound it; this one keeps
// every item independent, fast, and parallelizable — and now hard-capped so
// one slow item can't stall the rest of the batch either.
async function researchOne(target: ResearchTarget): Promise<ReportedItem | null> {
  return Promise.race([
    researchOneInner(target).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), PER_ITEM_TIMEOUT_MS)),
  ]);
}

export type BriefVerifyResult = {
  ok: boolean;
  updated: number;
  items?: { key: string; value_display: string }[];
  error?: string;
};

export async function runBriefVerification(): Promise<BriefVerifyResult> {
  const results = await Promise.allSettled(RESEARCH_TARGETS.map((t) => researchOne(t)));

  const admin = getAdmin();
  let updated = 0;
  const items: { key: string; value_display: string }[] = [];
  const failures: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const target = RESEARCH_TARGETS[i];
    const result = results[i];

    if (result.status === "rejected") {
      failures.push(`${target.key}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      continue;
    }
    const item = result.value;
    if (!item?.value_display || !item.source_url) {
      failures.push(`${target.key}: model did not report a usable result`);
      continue;
    }

    const { error } = await admin.from("brief_data_points").upsert({
      key: target.key,
      label: target.label,
      value_display: String(item.value_display),
      value_number: typeof item.value_number === "number" ? item.value_number : null,
      source_url: String(item.source_url),
      source_title: item.source_title ? String(item.source_title) : null,
      note: item.note ? String(item.note) : null,
      verified_at: new Date().toISOString(),
    }, { onConflict: "key" });

    if (error) {
      failures.push(`${target.key}: ${error.message}`);
      continue;
    }
    updated++;
    items.push({ key: target.key, value_display: String(item.value_display) });
  }

  if (updated === 0) {
    return { ok: false, updated: 0, error: failures.join("; ") || "No items could be verified." };
  }
  return {
    ok: true,
    updated,
    items,
    ...(failures.length ? { error: `${failures.length}/${RESEARCH_TARGETS.length} item(s) failed: ${failures.join("; ")}` } : {}),
  };
}
