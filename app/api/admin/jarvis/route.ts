import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin, first_name")
    .eq("id", user.id)
    .single();
  return profile?.is_admin ? { ...user, first_name: profile.first_name } : null;
}

// ── Pre-fetch context for system prompt injection ──────────────────────────────
// Runs in parallel with auth so it adds ~0ms to total latency.
// By injecting live numbers into the prompt, common queries ("how many users?",
// "what's MRR?") resolve in ONE Claude pass with zero tool calls.

async function fetchContextStats() {
  const admin = getAdmin();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: { users: allUsers } }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, plan, plan_status, trial_ends_at, is_test"),
  ]);

  const testIds = new Set((profiles ?? []).filter((p: any) => p.is_test).map((p: any) => p.id));
  const real = (allUsers ?? []).filter(
    (u: any) => !u.email?.endsWith("@demo.usecineflow.com") && !testIds.has(u.id)
  );
  const realIds = new Set(real.map((u: any) => u.id));
  const rp = (profiles ?? []).filter((p: any) => realIds.has(p.id));

  const planMRR: Record<string, number> = { solo: 39, studio: 79, agency: 159, enterprise: 299 };
  const mrr = rp
    .filter((p: any) => (p.plan_status === "active" || p.plan_status === "founding") && p.plan !== "lifetime")
    .reduce((s: number, p: any) => s + (planMRR[p.plan] ?? 0), 0);

  const breakdown = rp.reduce((acc: Record<string, number>, p: any) => {
    if (p.plan) acc[p.plan] = (acc[p.plan] || 0) + 1;
    return acc;
  }, {});

  return {
    total: real.length,
    signupsToday: real.filter((u: any) => new Date(u.created_at) >= today).length,
    signupsWeek: real.filter((u: any) => u.created_at >= weekAgo).length,
    activeLastWeek: real.filter((u: any) => u.last_sign_in_at && u.last_sign_in_at >= weekAgo).length,
    paid: rp.filter((p: any) => p.plan_status === "active" || p.plan_status === "founding" || p.plan === "lifetime").length,
    trialing: rp.filter((p: any) => p.plan_status === "trialing" && new Date(p.trial_ends_at) > new Date()).length,
    expired: rp.filter((p: any) => p.plan_status === "trialing" && new Date(p.trial_ends_at) <= new Date()).length,
    mrr,
    arr: mrr * 12,
    breakdown,
  };
}

// ── Tool implementations ───────────────────────────────────────────────────────

async function executeGetStats() {
  return fetchContextStats();
}

async function executeGetRevenue() {
  const admin = getAdmin();
  const planMRR: Record<string, number> = { solo: 39, studio: 79, agency: 159, enterprise: 299 };

  const { data: profiles } = await admin
    .from("profiles")
    .select("plan, plan_status, is_test")
    .in("plan_status", ["active", "founding"])
    .neq("is_test", true);

  let mrr = 0;
  const breakdown: Record<string, number> = {};
  for (const p of profiles ?? []) {
    if (p.plan === "lifetime") continue;
    mrr += planMRR[p.plan] ?? 0;
    breakdown[p.plan] = (breakdown[p.plan] || 0) + 1;
  }

  const { data: lifetimeProfiles } = await admin
    .from("profiles")
    .select("id")
    .eq("plan", "lifetime")
    .neq("is_test", true);

  return {
    mrr,
    arr: mrr * 12,
    lifetimeDeals: lifetimeProfiles?.length ?? 0,
    lifetimeRevenue: (lifetimeProfiles?.length ?? 0) * 299,
    planBreakdown: breakdown,
  };
}

async function executeGetFeedback() {
  const admin = getAdmin();
  const { data: feedback } = await admin
    .from("feedback")
    .select("content, type, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  return { items: feedback ?? [], count: feedback?.length ?? 0 };
}

async function executeGetFeatureFlags() {
  const admin = getAdmin();
  const { data: flags } = await admin
    .from("feature_flags")
    .select("id, key, description, enabled")
    .order("key");
  return { flags: flags ?? [] };
}

async function executeSendBroadcast(args: { segment: string; subject: string; message: string }) {
  if (!process.env.RESEND_API_KEY) return { error: "Email not configured" };

  const admin = getAdmin();
  const now = new Date().toISOString();

  let query = admin
    .from("profiles")
    .select("id, first_name, last_name, plan, plan_status, trial_ends_at, is_test")
    .neq("is_test", true);

  if (args.segment === "paid") {
    query = query.or("plan_status.eq.active,plan_status.eq.founding,plan.eq.lifetime") as typeof query;
  } else if (args.segment === "trialing") {
    query = query.eq("plan_status", "trialing").gt("trial_ends_at", now) as typeof query;
  } else if (args.segment === "trial_expired") {
    query = query.eq("plan_status", "trialing").lte("trial_ends_at", now) as typeof query;
  } else if (["solo", "studio", "agency", "enterprise", "lifetime"].includes(args.segment)) {
    query = query.eq("plan", args.segment) as typeof query;
  }

  const { data: profiles } = await query;
  if (!profiles?.length) return { error: "No recipients for this segment" };

  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap = new Map((authUsers ?? []).map((u: any) => [u.id, u.email]));

  const recipients = profiles
    .map((p: any) => ({
      email: emailMap.get(p.id),
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "there",
    }))
    .filter((r: any) => r.email && !r.email.endsWith("@demo.usecineflow.com"));

  if (!recipients.length) return { error: "No valid email recipients" };

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    await Promise.all(
      recipients.slice(i, i + batchSize).map((r: any) =>
        resend.emails.send({
          from: "Kenny at Cineflow <kenny@usecineflow.com>",
          to: r.email,
          subject: args.subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><p>Hi ${r.name},</p><p>${args.message.replace(/\n/g, "<br/>")}</p><p style="margin-top:24px;color:#666;font-size:12px">— Kenny<br/>Cineflow</p></div>`,
        })
      )
    );
    sent += Math.min(batchSize, recipients.length - i);
  }

  return { sent, total: recipients.length, segment: args.segment };
}

async function executeCreateAnnouncement(args: { message: string; type?: string }) {
  const admin = getAdmin();
  const { data, error } = await admin.from("announcements").insert({
    message: args.message,
    type: args.type ?? "info",
    is_active: true,
  }).select().single();
  if (error) return { error: error.message };
  return { created: true, id: data.id };
}

async function executeToggleFeatureFlag(args: { key: string; enabled: boolean }) {
  const admin = getAdmin();
  const { error } = await admin
    .from("feature_flags")
    .update({ enabled: args.enabled, updated_at: new Date().toISOString() })
    .eq("key", args.key);
  if (error) return { error: error.message };
  return { toggled: true, key: args.key, enabled: args.enabled };
}

// ── Tools ──────────────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_stats",
    description: "Get detailed user stats beyond what's already in the system prompt (churn breakdown, expired trials, week-over-week, etc).",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_revenue",
    description: "Get detailed revenue data: plan breakdown, lifetime deal count, invoice totals.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_feedback",
    description: "Read the latest 5 user feedback submissions.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_feature_flags",
    description: "List all feature flags and their enabled/disabled state.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "send_broadcast",
    description: "Send an email broadcast to a segment of users.",
    input_schema: {
      type: "object" as const,
      properties: {
        segment: { type: "string", enum: ["all", "paid", "trialing", "trial_expired", "solo", "studio", "agency", "enterprise", "lifetime"] },
        subject: { type: "string" },
        message: { type: "string" },
      },
      required: ["segment", "subject", "message"],
    },
  },
  {
    name: "create_announcement",
    description: "Create an in-app announcement banner for users.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string" },
        type: { type: "string", enum: ["info", "warning", "success", "error"] },
      },
      required: ["message"],
    },
  },
  {
    name: "toggle_feature_flag",
    description: "Enable or disable a feature flag by key.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: { type: "string" },
        enabled: { type: "boolean" },
      },
      required: ["key", "enabled"],
    },
  },
];

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Run auth + stats pre-fetch in parallel — saves ~200ms on every request
  const [caller, liveData] = await Promise.all([
    requireAdmin(),
    fetchContextStats().catch(() => null),
  ]);

  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { command } = await req.json();
  if (!command?.trim()) return NextResponse.json({ error: "command required" }, { status: 400 });

  const firstName = (caller as any).first_name || "Kenny";

  const dataBlock = liveData
    ? `\n\nLIVE CINEFLOW DATA — use these numbers directly for simple questions (no tool call needed):
- Total real users: ${liveData.total}
- Signups today: ${liveData.signupsToday} | this week: ${liveData.signupsWeek}
- Active last 7 days: ${liveData.activeLastWeek}
- Paid accounts: ${liveData.paid} | Trialing: ${liveData.trialing} | Trial expired: ${liveData.expired}
- MRR: $${liveData.mrr} | ARR: $${liveData.arr}
- Plan breakdown: ${JSON.stringify(liveData.breakdown)}
Only call get_stats/get_revenue if the user needs something more granular than the above.`
    : "";

  const systemPrompt = `You are Jarvis — AI command intelligence built into Cineflow, a film production SaaS.
You are speaking directly to ${firstName}, the founder and sole admin.

Character: Confident, precise, cinematic. Like J.A.R.V.I.S. from Iron Man — sharp wit, never robotic.
Address ${firstName} by name occasionally. Keep responses concise — 1-3 sentences for voice.
When reporting numbers, be specific. When taking actions, confirm what you did.
Current time: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" })}.
Pricing reference: Solo $39/mo, Studio $79/mo, Agency $159/mo, Enterprise $299/mo, Lifetime $299 one-time.${dataBlock}`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: command }];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: systemPrompt,
    tools: TOOLS,
    messages,
  });

  let text = "";

  if (response.stop_reason === "tool_use") {
    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")!;
    let toolResult: unknown;

    switch (toolUse.name) {
      case "get_stats":           toolResult = await executeGetStats(); break;
      case "get_revenue":         toolResult = await executeGetRevenue(); break;
      case "get_feedback":        toolResult = await executeGetFeedback(); break;
      case "get_feature_flags":   toolResult = await executeGetFeatureFlags(); break;
      case "send_broadcast":      toolResult = await executeSendBroadcast(toolUse.input as any); break;
      case "create_announcement": toolResult = await executeCreateAnnouncement(toolUse.input as any); break;
      case "toggle_feature_flag": toolResult = await executeToggleFeatureFlag(toolUse.input as any); break;
      default:                    toolResult = { error: "Unknown tool" };
    }

    const followUp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      tools: TOOLS,
      messages: [
        ...messages,
        { role: "assistant", content: response.content },
        { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }] },
      ],
    });

    text = followUp.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  } else {
    text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  }

  if (!text) return NextResponse.json({ text: "" });

  // Stream ElevenLabs audio directly — no second round-trip from the client
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "onwK4e9ZLuTAKqWW03F9";

  if (apiKey) {
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, 600),
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.15, use_speaker_boost: true },
      }),
    });

    if (ttsRes.ok && ttsRes.body) {
      return new NextResponse(ttsRes.body, {
        headers: {
          "Content-Type": "audio/mpeg",
          "X-Jarvis-Text": encodeURIComponent(text.slice(0, 800)),
          "Access-Control-Expose-Headers": "X-Jarvis-Text",
          "Cache-Control": "no-store",
        },
      });
    }
  }

  // Fallback: return text only (ElevenLabs not configured or failed)
  return NextResponse.json({ text });
}
