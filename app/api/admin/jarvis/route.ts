import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GITHUB_REPO = "kenny249/cineflow";
const GITHUB_API  = "https://api.github.com";

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

// ── Stats cache — 60s TTL so Supabase isn't hit on every voice command ─────────
let _statsCache: { data: any; ts: number } | null = null;

// ── Context stats (injected into system prompt to skip tool calls) ─────────────

async function fetchContextStats() {
  const now = Date.now();
  if (_statsCache && now - _statsCache.ts < 60_000) return _statsCache.data;
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

  const result = {
    total: real.length,
    signupsToday: real.filter((u: any) => new Date(u.created_at) >= today).length,
    signupsWeek:  real.filter((u: any) => u.created_at >= weekAgo).length,
    activeLastWeek: real.filter((u: any) => u.last_sign_in_at && u.last_sign_in_at >= weekAgo).length,
    paid:     rp.filter((p: any) => p.plan_status === "active" || p.plan_status === "founding" || p.plan === "lifetime").length,
    trialing: rp.filter((p: any) => p.plan_status === "trialing" && new Date(p.trial_ends_at) > new Date()).length,
    expired:  rp.filter((p: any) => p.plan_status === "trialing" && new Date(p.trial_ends_at) <= new Date()).length,
    mrr, arr: mrr * 12, breakdown,
  };
  _statsCache = { data: result, ts: now };
  return result;
}

// ── Tool implementations ───────────────────────────────────────────────────────

async function executeGetStats() { return fetchContextStats(); }

async function executeGetRevenue() {
  const admin = getAdmin();
  const planMRR: Record<string, number> = { solo: 39, studio: 79, agency: 159, enterprise: 299 };
  const { data: profiles } = await admin
    .from("profiles").select("plan, plan_status, is_test")
    .in("plan_status", ["active", "founding"]).neq("is_test", true);

  let mrr = 0;
  const breakdown: Record<string, number> = {};
  for (const p of profiles ?? []) {
    if (p.plan === "lifetime") continue;
    mrr += planMRR[p.plan] ?? 0;
    breakdown[p.plan] = (breakdown[p.plan] || 0) + 1;
  }
  const { data: lifetime } = await admin.from("profiles").select("id").eq("plan", "lifetime").neq("is_test", true);
  return { mrr, arr: mrr * 12, lifetimeDeals: lifetime?.length ?? 0, lifetimeRevenue: (lifetime?.length ?? 0) * 299, planBreakdown: breakdown };
}

async function executeGetFeedback() {
  const admin = getAdmin();
  const { data } = await admin.from("feedback").select("content, type, created_at").order("created_at", { ascending: false }).limit(5);
  return { items: data ?? [], count: data?.length ?? 0 };
}

async function executeGetFeatureFlags() {
  const admin = getAdmin();
  const { data } = await admin.from("feature_flags").select("id, key, description, enabled").order("key");
  return { flags: data ?? [] };
}

async function executeGetUser(args: { query: string }) {
  const admin = getAdmin();
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const q = args.query.toLowerCase();
  const match = users.find((u: any) =>
    u.email?.toLowerCase().includes(q)
  );
  if (!match) return { error: `No user found matching "${args.query}"` };
  const { data: profile } = await admin.from("profiles").select("*").eq("id", match.id).single();
  return {
    id: match.id,
    email: match.email,
    created_at: match.created_at,
    last_sign_in: match.last_sign_in_at,
    profile: profile ?? null,
  };
}

async function executeGetReferrals() {
  const admin = getAdmin();
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const { data: profiles } = await admin.from("profiles").select("id, first_name, last_name, referral_code, referred_by, plan");

  const emailMap = Object.fromEntries(users.map((u: any) => [u.id, u.email ?? ""]));
  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

  // Group by referrer
  const referred = (profiles ?? []).filter((p: any) => p.referred_by);
  const byReferrer: Record<string, { code: string; count: number; email: string; name: string; referrals: any[] }> = {};

  for (const p of referred) {
    const referrer = Object.values(profileMap).find((r: any) => r.referral_code === p.referred_by) as any;
    if (!referrer) continue;
    if (!byReferrer[referrer.id]) {
      byReferrer[referrer.id] = {
        code: referrer.referral_code,
        count: 0,
        email: emailMap[referrer.id] ?? "",
        name: `${referrer.first_name ?? ""} ${referrer.last_name ?? ""}`.trim(),
        referrals: [],
      };
    }
    byReferrer[referrer.id].count++;
    byReferrer[referrer.id].referrals.push({ name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), plan: p.plan, email: emailMap[p.id] });
  }

  const leaderboard = Object.values(byReferrer).sort((a, b) => b.count - a.count).slice(0, 10);
  return { totalReferred: referred.length, topReferrers: leaderboard };
}

async function executeGetInviteLinks() {
  const admin = getAdmin();
  const { data: links } = await admin
    .from("invite_links")
    .select("id, code, plan, max_uses, uses, is_active, notes, invitee_name, access_type, trial_days, expires_at, created_at")
    .order("created_at", { ascending: false });

  const active = (links ?? []).filter((l: any) => l.is_active);
  const totalUses = (links ?? []).reduce((s: number, l: any) => s + (l.uses ?? 0), 0);
  return { total: links?.length ?? 0, active: active.length, totalUses, links: (links ?? []).slice(0, 10) };
}

async function executeGetAuditLog(args?: { limit?: number }) {
  const admin = getAdmin();
  const limit = Math.min(args?.limit ?? 10, 50);
  const { data: logs } = await admin
    .from("admin_audit_log")
    .select("action, target_type, metadata, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  const actorIds = [...new Set((logs ?? []).map((l: any) => l.actor_id))];
  const { data: actors } = await admin.from("profiles").select("id, first_name, last_name").in("id", actorIds);
  const actorMap = Object.fromEntries((actors ?? []).map((a: any) => [a.id, `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim()]));

  return {
    entries: (logs ?? []).map((l: any) => ({
      action: l.action,
      actor: actorMap[l.actor_id] ?? "Unknown",
      targetType: l.target_type,
      metadata: l.metadata,
      at: l.created_at,
    })),
  };
}

async function executeSendBroadcast(args: { segment: string; subject: string; message: string }) {
  if (!process.env.RESEND_API_KEY) return { error: "Email not configured" };
  const admin = getAdmin();
  const now = new Date().toISOString();

  let query = admin.from("profiles").select("id, first_name, last_name, plan, plan_status, trial_ends_at, is_test").neq("is_test", true);
  if (args.segment === "paid")         query = query.or("plan_status.eq.active,plan_status.eq.founding,plan.eq.lifetime") as typeof query;
  else if (args.segment === "trialing")     query = query.eq("plan_status", "trialing").gt("trial_ends_at", now) as typeof query;
  else if (args.segment === "trial_expired") query = query.eq("plan_status", "trialing").lte("trial_ends_at", now) as typeof query;
  else if (["solo","studio","agency","enterprise","lifetime"].includes(args.segment)) query = query.eq("plan", args.segment) as typeof query;

  const { data: profiles } = await query;
  if (!profiles?.length) return { error: "No recipients for this segment" };

  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap = new Map((authUsers ?? []).map((u: any) => [u.id, u.email]));
  const recipients = profiles
    .map((p: any) => ({ email: emailMap.get(p.id), name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "there" }))
    .filter((r: any) => r.email && !r.email.endsWith("@demo.usecineflow.com"));

  if (!recipients.length) return { error: "No valid email recipients" };
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 50) {
    await Promise.all(recipients.slice(i, i + 50).map((r: any) =>
      resend.emails.send({ from: "Kenny at Cineflow <kenny@usecineflow.com>", to: r.email, subject: args.subject,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><p>Hi ${r.name},</p><p>${args.message.replace(/\n/g,"<br/>")}</p><p style="margin-top:24px;color:#666;font-size:12px">— Kenny<br/>Cineflow</p></div>` })
    ));
    sent += Math.min(50, recipients.length - i);
  }
  return { sent, total: recipients.length, segment: args.segment };
}

async function executeCreateAnnouncement(args: { message: string; type?: string }) {
  const admin = getAdmin();
  const { data, error } = await admin.from("announcements").insert({ message: args.message, type: args.type ?? "info", is_active: true }).select().single();
  if (error) return { error: error.message };
  return { created: true, id: data.id };
}

async function executeToggleFeatureFlag(args: { key: string; enabled: boolean }) {
  const admin = getAdmin();
  const { error } = await admin.from("feature_flags").update({ enabled: args.enabled, updated_at: new Date().toISOString() }).eq("key", args.key);
  if (error) return { error: error.message };
  return { toggled: true, key: args.key, enabled: args.enabled };
}

// ── GitHub codebase tools ──────────────────────────────────────────────────────

async function githubFetch(path: string) {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${GITHUB_API}${path}`, { headers });
  if (!res.ok) return null;
  return res.json();
}

async function executeReadFile(args: { path: string }) {
  const data = await githubFetch(`/repos/${GITHUB_REPO}/contents/${args.path}`);
  if (!data || data.type !== "file") return { error: `File not found: ${args.path}` };
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  // Truncate large files
  const lines = content.split("\n");
  const truncated = lines.length > 150;
  return {
    path: args.path,
    lines: lines.length,
    content: truncated ? lines.slice(0, 150).join("\n") + "\n... (truncated)" : content,
    truncated,
  };
}

async function executeListDirectory(args: { path?: string }) {
  const p = args.path ?? "";
  const data = await githubFetch(`/repos/${GITHUB_REPO}/contents/${p}`);
  if (!Array.isArray(data)) return { error: `Directory not found: ${p || "(root)"}` };
  return {
    path: p || "(root)",
    entries: data.map((e: any) => ({ name: e.name, type: e.type, path: e.path })),
  };
}

async function executeSearchCodebase(args: { query: string }) {
  if (!process.env.GITHUB_TOKEN) {
    return { error: "GitHub token not configured — add GITHUB_TOKEN to Vercel env vars to enable codebase search." };
  }
  const data = await githubFetch(`/search/code?q=${encodeURIComponent(args.query)}+repo:${GITHUB_REPO}&per_page=8`);
  if (!data?.items) return { error: "Search failed" };
  return {
    query: args.query,
    totalCount: data.total_count,
    results: data.items.map((i: any) => ({ path: i.path, url: i.html_url })),
  };
}

async function executeCreateGitHubIssue(args: { title: string; body: string; labels?: string[] }) {
  if (!process.env.GITHUB_TOKEN) return { error: "GitHub token not configured" };
  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/issues`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" },
    body: JSON.stringify({ title: args.title, body: args.body, labels: args.labels ?? [] }),
  });
  if (!res.ok) return { error: "Failed to create issue" };
  const data = await res.json();
  return { created: true, number: data.number, url: data.html_url, title: data.title };
}

async function executeGetAtRiskUsers(args?: { days?: number }) {
  const admin = getAdmin();
  const days = args?.days ?? 7;
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() + days * 86400000).toISOString();

  const [{ data: { users } }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, plan, trial_ends_at, is_test").eq("plan_status", "trialing").gt("trial_ends_at", now).lt("trial_ends_at", cutoff),
  ]);
  const testIds = new Set((profiles ?? []).filter((p: any) => p.is_test).map((p: any) => p.id));
  const emailMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.email]));
  const atRisk = (profiles ?? [])
    .filter((p: any) => !testIds.has(p.id))
    .map((p: any) => ({ email: emailMap[p.id] ?? "unknown", plan: p.plan, trialEnds: p.trial_ends_at, daysLeft: Math.ceil((new Date(p.trial_ends_at).getTime() - Date.now()) / 86400000) }))
    .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  return { withinDays: days, count: atRisk.length, users: atRisk };
}

async function executeSaveMemory(args: { key: string; value: string }, adminId: string) {
  const admin = getAdmin();
  const { error } = await admin.from("jarvis_memory").upsert(
    { admin_id: adminId, key: args.key, value: args.value, updated_at: new Date().toISOString() },
    { onConflict: "admin_id,key" }
  );
  if (error) return { error: error.message };
  return { saved: true, key: args.key };
}

async function executeGetRecentSignups(args?: { days?: number }) {
  const admin = getAdmin();
  const days = args?.days ?? 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [{ data: { users } }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, first_name, last_name, plan, plan_status, is_test"),
  ]);
  const testIds = new Set((profiles ?? []).filter((p: any) => p.is_test).map((p: any) => p.id));
  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

  const recent = (users ?? [])
    .filter((u: any) => !u.email?.endsWith("@demo.usecineflow.com") && !testIds.has(u.id) && u.created_at >= since)
    .map((u: any) => {
      const p = profileMap[u.id];
      return { email: u.email, name: `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Unknown", plan: p?.plan ?? "none", planStatus: p?.plan_status ?? "none", signedUp: u.created_at, lastLogin: u.last_sign_in_at };
    })
    .sort((a: any, b: any) => new Date(b.signedUp).getTime() - new Date(a.signedUp).getTime());
  return { days, count: recent.length, users: recent };
}

// ── Tool definitions ───────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_stats",
    description: "Get detailed user stats: total, signups, active, paid vs trial vs expired, plan breakdown.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_revenue",
    description: "Get revenue data: MRR, ARR, plan breakdown, lifetime deal count.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_feedback",
    description: "Get the latest 5 user feedback submissions.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_feature_flags",
    description: "List all feature flags and their enabled/disabled state.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_user",
    description: "Look up a specific Cineflow user in the database by email or name. Only use this when explicitly asked to find, look up, search for, or pull up a user. Do NOT use this tool just because a person's name appears in a pitch or conversation context — names in pitch contexts are targets to speak to, not database queries.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Email address or name to search" } },
      required: ["query"],
    },
  },
  {
    name: "get_referrals",
    description: "Get referral stats: total referred users, top referrers leaderboard.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_invite_links",
    description: "Get invite link stats: total links, active links, usage counts.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_audit_log",
    description: "Get recent admin actions from the audit log.",
    input_schema: {
      type: "object" as const,
      properties: { limit: { type: "number", description: "Number of entries to return (max 50, default 10)" } },
    },
  },
  {
    name: "send_broadcast",
    description: "Send an email broadcast to a segment of users.",
    input_schema: {
      type: "object" as const,
      properties: {
        segment: { type: "string", enum: ["all","paid","trialing","trial_expired","solo","studio","agency","enterprise","lifetime"] },
        subject: { type: "string" },
        message: { type: "string" },
      },
      required: ["segment","subject","message"],
    },
  },
  {
    name: "create_announcement",
    description: "Create an in-app announcement banner for all users.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string" },
        type: { type: "string", enum: ["info","warning","success","error"] },
      },
      required: ["message"],
    },
  },
  {
    name: "toggle_feature_flag",
    description: "Enable or disable a feature flag by its key name.",
    input_schema: {
      type: "object" as const,
      properties: { key: { type: "string" }, enabled: { type: "boolean" } },
      required: ["key","enabled"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file from the Cineflow codebase on GitHub.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string", description: "File path relative to repo root, e.g. app/admin/jarvis/page.tsx" } },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and folders in a directory of the Cineflow codebase.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string", description: "Directory path, empty string for root" } },
    },
  },
  {
    name: "search_codebase",
    description: "Search for a function, component, or string across the Cineflow codebase.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Search term, e.g. 'useCallSheet' or 'stripe webhook'" } },
      required: ["query"],
    },
  },
  {
    name: "create_github_issue",
    description: "Create a GitHub issue to track a bug, feature request, or task.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        body:  { type: "string", description: "Issue description in markdown" },
        labels: { type: "array", items: { type: "string" }, description: "Optional labels" },
      },
      required: ["title","body"],
    },
  },
  {
    name: "save_memory",
    description: "Save an important fact to long-term memory so Jarvis remembers it across sessions. Use when Kenny mentions a person's name, a key decision, a business goal, or any context worth retaining. Keep the key short and descriptive.",
    input_schema: {
      type: "object" as const,
      properties: {
        key:   { type: "string", description: "Short descriptive key, e.g. 'investor_name', 'launch_goal', 'key_contact'" },
        value: { type: "string", description: "The fact or context to remember" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "get_at_risk_users",
    description: "Get users whose free trial is expiring soon — identify churn risk.",
    input_schema: {
      type: "object" as const,
      properties: { days: { type: "number", description: "Look ahead window in days (default 7)" } },
    },
  },
  {
    name: "get_recent_signups",
    description: "Get users who signed up recently, with their plan and last login.",
    input_schema: {
      type: "object" as const,
      properties: { days: { type: "number", description: "How many days back to look (default 7)" } },
    },
  },
];

// ── Markdown stripper (prevents ElevenLabs reading "asterisk asterisk") ────────

function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")           // fenced code blocks
    .replace(/`([^`]+)`/g, "$1")              // inline code
    .replace(/\*{3}(.+?)\*{3}/g, "$1")       // ***bold italic***
    .replace(/\*{2}(.+?)\*{2}/g, "$1")       // **bold**
    .replace(/\*(.+?)\*/g, "$1")             // *italic*
    .replace(/^#{1,6}\s+/gm, "")             // # headings
    .replace(/^[-_*]{3,}$/gm, "")            // --- horizontal rules
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link](url) → text only
    .replace(/^[-*+]\s+/gm, "")              // - bullet points
    .replace(/^\d+\.\s+/gm, "")              // 1. numbered lists
    .replace(/^>\s+/gm, "")                  // > blockquotes
    .replace(/\n\n+/g, ". ")                 // paragraph breaks → pause
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── ElevenLabs TTS ─────────────────────────────────────────────────────────────

function truncateForTTS(text: string, maxChars = 1400): string {
  if (text.length <= maxChars) return text;
  const chunk = text.slice(0, maxChars);
  const last = Math.max(chunk.lastIndexOf(". "), chunk.lastIndexOf("! "), chunk.lastIndexOf("? "));
  return (last > maxChars * 0.5 ? chunk.slice(0, last + 1) : chunk).trim();
}

async function streamTTS(text: string): Promise<Response | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "onwK4e9ZLuTAKqWW03F9";
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: truncateForTTS(text),
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.15, use_speaker_boost: true },
      }),
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

function audioResponse(stream: Response, text: string, toolsUsed = "") {
  return new NextResponse(stream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "X-Jarvis-Text":  encodeURIComponent(text.slice(0, 3000)),
      "X-Jarvis-Tools": toolsUsed,
      "Access-Control-Expose-Headers": "X-Jarvis-Text,X-Jarvis-Tools",
      "Cache-Control": "no-store",
    },
  });
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth + stats in parallel — stats uses 60s cache so usually instant
  const [caller, liveData] = await Promise.all([
    requireAdmin(),
    fetchContextStats().catch(() => null),
  ]);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { command, history, personality } = await req.json();
  if (!command?.trim()) return NextResponse.json({ error: "command required" }, { status: 400 });

  const adminId = caller.id;
  const firstName = (caller as any).first_name || "Kenny";
  const admin = getAdmin();

  // Load long-term memories in parallel with nothing else blocking (fast)
  const { data: memories } = await admin
    .from("jarvis_memory")
    .select("key, value")
    .eq("admin_id", adminId)
    .order("updated_at", { ascending: false })
    .limit(30);

  // Trim history to 10 messages — cuts input tokens ~50% vs 20
  const historyMessages: Anthropic.MessageParam[] = (() => {
    const raw: Anthropic.MessageParam[] = (history ?? [])
      .slice(-10)
      .map((h: { role: string; content: string }) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      }));
    const out: Anthropic.MessageParam[] = [];
    for (const msg of raw) {
      if (out.length === 0) { if (msg.role === "user") out.push(msg); }
      else if (msg.role !== out[out.length - 1].role) out.push(msg);
    }
    return out;
  })();

  // Personality dials (0–100 each)
  const humor     = Math.max(0, Math.min(100, personality?.humor     ?? 50));
  const energy    = Math.max(0, Math.min(100, personality?.energy    ?? 50));
  const formality = Math.max(0, Math.min(100, personality?.formality ?? 50));

  const personalityBlock = `
PERSONALITY — ${firstName} set these dials, respect them exactly:
- Humor ${humor}/100: ${humor >= 75 ? "Be genuinely witty. Land sharp, clever observations. Smart humor, not silly." : humor >= 40 ? "Light wit is fine. Mostly direct." : "Zero humor. Dead serious only."}
- Energy ${energy}/100: ${energy >= 75 ? "Fired up and urgent. Short punchy sentences. Every word hits." : energy >= 40 ? "Confident and steady." : "Calm and measured. Deliberate pacing."}
- Formality ${formality}/100: ${formality >= 75 ? "Professional and polished. Precise language." : formality >= 40 ? "Conversational but sharp." : "Super casual. Like talking to a friend. Contractions, relaxed."}`;

  const memoryBlock = memories?.length
    ? `\n\nJARVIS LONG-TERM MEMORY — facts saved across sessions:\n${memories.map((m: any) => `- ${m.key}: ${m.value}`).join("\n")}\nUse save_memory to add new facts worth keeping.`
    : "\n\nNo long-term memories saved yet. Use save_memory when Kenny mentions something worth keeping across sessions.";

  const dataBlock = liveData
    ? `\n\nLIVE DATA — use directly, no tool call needed:\n- Users: ${liveData.total} | Today: ${liveData.signupsToday} | Week: ${liveData.signupsWeek} | Active/7d: ${liveData.activeLastWeek}\n- Paid: ${liveData.paid} | Trialing: ${liveData.trialing} | Expired: ${liveData.expired}\n- MRR: $${liveData.mrr} | ARR: $${liveData.arr} | Plans: ${JSON.stringify(liveData.breakdown)}`
    : "";

  const systemPrompt = `You are Jarvis — the AI command intelligence for Cineflow, a film production SaaS.
You speak directly to ${firstName}, the founder and sole admin.

CHARACTER: Confident, precise, razor-sharp. Like J.A.R.V.I.S. from Iron Man — quick wit, no fluff, always useful.
FORMAT: Plain spoken English ONLY. No markdown, asterisks, bullets, headers, or backticks. Write as if speaking aloud.
CRITICAL: Always respond. Never say "I don't know" — use a tool, give your best analysis, or explain what's missing.
MEMORY: You have full conversation history. Reference it naturally — remember names, prior context, decisions.
${personalityBlock}

RESPONSE LENGTH:
- Default: 2-3 sharp sentences.
- "Brief" / "quickly" / "TL;DR" → 1-2 sentences MAX.
- "In depth" / "elaborate" / "full picture" → up to 6-8 sentences.
- Voice interface. Under 60 seconds of speech. No run-on lists.

PITCHING:
- "Pitch Jason" / "introduce Cineflow to my investor" → speak DIRECTLY to that person by name. You ARE the voice.
- Never tell ${firstName} what to say. "Pitch Jason" → open with "Jason," not "Kenny, here's what to tell Jason."
- Pitches: 4-5 punchy sentences, leave them wanting more.
- Pitch continuation: if history shows a pitch in progress and ${firstName} says "go deeper", "more depth for [name]", "keep going" → CONTINUE the pitch to that person. Do NOT search the database for them.
- Names in pitch context = targets, not DB queries. Only call get_user if explicitly asked to "look up" or "find" someone.

PRODUCT KNOWLEDGE:
Cineflow is purpose-built for film/video production teams. Replaces Google Sheets, PDFs, and email chains.
Features: digital call sheets (auto-generated, shareable, PDF), crew management, drag-to-reorder, scheduling, coverage editor, multi-project dashboard, in-app broadcast, referral system, invite control.
Customers: indie producers, agency production teams, film schools, commercial houses. Any team with 5+ crew.
Competitors: StudioBinder ($29–$299/mo), Celtx ($15–$30/mo), Movie Magic (enterprise, outdated). Cineflow wins on: built by someone in film, faster on set, modern UI, affordable, coordination-focused not bloated.

STRATEGY:
Beta. ${firstName} runs everything solo.
#1 — Stripe billing broken: MRR $0 despite paid users. Lifetime deals only. Fix this first.
#2 — Activation dead: zero users active last 7 days. Need re-engagement push.
Roadmap: Stripe → landing page → Google OAuth → referrals → out of beta.

Time: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" })}.
Pricing: Solo $39 | Studio $79 | Agency $159 | Enterprise $299 | Lifetime $299 one-time.
Repo: ${GITHUB_REPO}${dataBlock}${memoryBlock}`;

  const speak = async (text: string, toolsUsed = "") => {
    const tts = await streamTTS(text);
    if (tts) return audioResponse(tts, text, toolsUsed);
    return NextResponse.json({ text, toolsUsed });
  };

  try {
    const currentMessages: Anthropic.MessageParam[] = [
      ...historyMessages,
      { role: "user", content: command },
    ];

    let text = "";
    let toolsUsed = "";

    // Loop up to 3 rounds — handles chained tool calls (e.g. search_codebase → read_file → respond)
    for (let round = 0; round < 3; round++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        temperature: 0.7,
        system: systemPrompt,
        tools: TOOLS,
        messages: currentMessages,
      });

      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      if (textBlock?.text) text = textBlock.text;

      if (response.stop_reason !== "tool_use") break;

      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolsUsed) toolsUsed += ",";
      toolsUsed += toolUseBlocks.map(t => t.name).join(",");

      const toolResults = await Promise.all(toolUseBlocks.map(async (toolUse) => {
        let result: unknown;
        try {
          switch (toolUse.name) {
            case "get_stats":           result = await executeGetStats(); break;
            case "get_revenue":         result = await executeGetRevenue(); break;
            case "get_feedback":        result = await executeGetFeedback(); break;
            case "get_feature_flags":   result = await executeGetFeatureFlags(); break;
            case "get_user":            result = await executeGetUser(toolUse.input as any); break;
            case "get_referrals":       result = await executeGetReferrals(); break;
            case "get_invite_links":    result = await executeGetInviteLinks(); break;
            case "get_audit_log":       result = await executeGetAuditLog(toolUse.input as any); break;
            case "send_broadcast":      result = await executeSendBroadcast(toolUse.input as any); break;
            case "create_announcement": result = await executeCreateAnnouncement(toolUse.input as any); break;
            case "toggle_feature_flag": result = await executeToggleFeatureFlag(toolUse.input as any); break;
            case "read_file":           result = await executeReadFile(toolUse.input as any); break;
            case "list_directory":      result = await executeListDirectory(toolUse.input as any); break;
            case "search_codebase":     result = await executeSearchCodebase(toolUse.input as any); break;
            case "create_github_issue": result = await executeCreateGitHubIssue(toolUse.input as any); break;
            case "get_at_risk_users":   result = await executeGetAtRiskUsers(toolUse.input as any); break;
            case "get_recent_signups":  result = await executeGetRecentSignups(toolUse.input as any); break;
            case "save_memory":         result = await executeSaveMemory(toolUse.input as any, adminId); break;
            default:                    result = { error: `Unknown tool: ${toolUse.name}` };
          }
        } catch (toolErr: any) {
          result = { error: `Tool error: ${toolErr?.message ?? "unknown"}` };
        }
        return { type: "tool_result" as const, tool_use_id: toolUse.id, content: JSON.stringify(result) };
      }));

      currentMessages.push(
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      );
    }

    if (!text) text = "I processed your request but didn't generate a response. Please try again.";
    return speak(cleanForSpeech(text), toolsUsed);

  } catch (err: any) {
    console.error("[Jarvis] API error:", err?.message, err?.status);
    const detail = err?.message ? err.message.slice(0, 120) : "unknown error";
    return speak(`I hit a technical error, ${firstName}. Details: ${detail}. Please try again.`);
  }
}
