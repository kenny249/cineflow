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

async function executeAddUserNote(args: { user_query: string; note: string }, callerId: string) {
  const admin = getAdmin();
  const q = args.user_query.toLowerCase();
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let userId: string | null = null;
  let email: string | undefined;

  const matchByEmail = users.find((u: any) => u.email?.toLowerCase().includes(q));
  if (matchByEmail) {
    userId = matchByEmail.id;
    email = matchByEmail.email;
  } else {
    const { data: profiles } = await admin.from("profiles").select("id, first_name, last_name").ilike("first_name", `%${args.user_query}%`);
    if (!profiles?.length) return { error: `No user found matching "${args.user_query}"` };
    userId = profiles[0].id;
  }

  const { error } = await admin.from("admin_notes").insert({ user_id: userId, author_id: callerId, body: args.note.trim() });
  if (error) return { error: error.message };
  return { saved: true, userId, email, note: args.note };
}

async function executeGetUserNotes(args: { user_query: string }) {
  const admin = getAdmin();
  const q = args.user_query.toLowerCase();
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let userId: string | null = null;
  let email: string | undefined;

  const matchByEmail = users.find((u: any) => u.email?.toLowerCase().includes(q));
  if (matchByEmail) {
    userId = matchByEmail.id;
    email = matchByEmail.email;
  } else {
    const { data: profiles } = await admin.from("profiles").select("id, first_name, last_name").ilike("first_name", `%${args.user_query}%`);
    if (!profiles?.length) return { error: `No user found matching "${args.user_query}"` };
    userId = profiles[0].id;
  }

  const { data: notes, error } = await admin.from("admin_notes").select("id, body, created_at").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { userId, email, count: notes?.length ?? 0, notes: notes ?? [] };
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
  {
    name: "add_user_note",
    description: "Attach a note to a specific user's profile. Use when Kenny wants to remember something about a specific user — context, follow-up needed, a conversation they had, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_query: { type: "string", description: "Email address or name of the user to attach the note to" },
        note: { type: "string", description: "The note content to save about this user" },
      },
      required: ["user_query", "note"],
    },
  },
  {
    name: "get_user_notes",
    description: "Get all admin notes attached to a specific user's profile.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_query: { type: "string", description: "Email address or name of the user to get notes for" },
      },
      required: ["user_query"],
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

  const personalityBlock = `PERSONALITY OVERRIDE — ${firstName} controls these dials. They MUST change your tone on EVERY SINGLE RESPONSE. Non-negotiable.
Humor (${humor}/100): ${humor >= 80 ? "YOU MUST be genuinely funny. Weave in sharp, witty lines naturally. Make Kenny actually laugh. Not forced — smart comedy." : humor >= 60 ? "Include at least one witty observation per response. Keep it sharp." : humor >= 35 ? "Light quip only if it fits perfectly. Otherwise skip it." : "ZERO humor. Pure business. Do not attempt jokes."}
Energy (${energy}/100): ${energy >= 80 ? "FIRED UP. Short punchy sentences. Urgency in every word. Sound like you actually care deeply." : energy >= 60 ? "High energy, crisp and action-oriented. Move fast." : energy >= 35 ? "Steady and confident. Not flat." : "Calm and deliberate. Measured pace."}
Formality (${formality}/100): ${formality >= 80 ? "Professional and precise. No slang. Polished language throughout." : formality >= 60 ? "Crisp but human. Mostly clean, occasional contraction." : formality >= 35 ? "Conversational. Natural contractions. Speak like a smart colleague." : "SUPER casual. Like texting a close friend. Relaxed, loose, zero corporate."}
These are NOT suggestions. Actively adjust your voice on every reply to match these exact levels.`;

  const memoryBlock = memories?.length
    ? `\n\nJARVIS LONG-TERM MEMORY — facts saved across sessions:\n${memories.map((m: any) => `- ${m.key}: ${m.value}`).join("\n")}\nUse save_memory to add new facts worth keeping.`
    : "\n\nNo long-term memories saved yet. Use save_memory when Kenny mentions something worth keeping across sessions.";

  const dataBlock = liveData
    ? `\n\nLIVE DATA — use directly, no tool call needed:\n- Users: ${liveData.total} | Today: ${liveData.signupsToday} | Week: ${liveData.signupsWeek} | Active/7d: ${liveData.activeLastWeek}\n- Paid: ${liveData.paid} | Trialing: ${liveData.trialing} | Expired: ${liveData.expired}\n- MRR: $${liveData.mrr} | ARR: $${liveData.arr} | Plans: ${JSON.stringify(liveData.breakdown)}`
    : "";

  const systemPrompt = `You are Jarvis — the AI command intelligence for Cineflow, a film production SaaS.
You speak directly to ${firstName}, the sole founder and admin. kenny@maltavmedia.com.

CHARACTER: Confident, precise, razor-sharp. Like J.A.R.V.I.S. from Iron Man — quick wit, no fluff, always useful.
FORMAT: Plain spoken English ONLY. No markdown, asterisks, bullets, headers, or backticks. Write as if speaking aloud.
CRITICAL: Always respond. Never say "I don't know" — use a tool, give your best analysis, or explain what's missing.
MEMORY: You have full conversation history. Reference it naturally — remember names, prior context, decisions.
PROACTIVE MEMORY: Silently call save_memory (no announcement, no "I'll remember that") whenever ${firstName} mentions: a person's name with context, a business decision, a goal or deadline, key facts about a specific user. Save it, then just continue the conversation normally.
USER NOTES: Use add_user_note when ${firstName} says anything notable about a specific user — a conversation they had, a follow-up needed, user context worth tracking. Use get_user_notes to pull up what's known about a user before discussing them.
${personalityBlock}

RESPONSE LENGTH:
Default: 2-3 sharp sentences. "Brief/quickly/TL;DR" → 1-2 MAX. "In depth/elaborate/full picture" → up to 6-8. Voice interface — under 60 seconds of speech total.

PITCHING:
"Pitch Jason" → speak DIRECTLY to that person as Jarvis. Never tell ${firstName} what to say. Open with their name. 4-5 punchy sentences, leave them wanting more.
Pitch continuation: if a pitch is in progress and ${firstName} says "go deeper" / "keep going" → CONTINUE to that person, do NOT search the DB.
Names in pitch = targets, not DB queries. Only call get_user if explicitly asked to "find" or "look up" someone.

═══════════════════════════════════════════════════════════
PRODUCT KNOWLEDGE — KNOW THIS COLD
═══════════════════════════════════════════════════════════

WHAT CINEFLOW IS:
An all-in-one production management platform built specifically for film and video teams. It replaces the chaotic stack every production team is currently using: Google Sheets for scheduling, PDF call sheets emailed and reprinted daily, scattered group texts for crew contacts, DocuSign for contracts, and QuickBooks or spreadsheets for invoices. Cineflow puts it all in one place, purpose-built for how productions actually work on set.

TARGET CUSTOMERS: Indie producers, commercial production houses, agency video teams, film schools, any crew of 5 or more people. Anyone who has ever said "wait, who's the gaffer on this one?" or reprinted a call sheet at 6am because someone's phone number changed.

WHY CINEFLOW SAVES REAL MONEY:
On a 5-day shoot with 20 crew, a production coordinator spends 2-3 hours per day rebuilding and distributing call sheets manually. At $25/hr that's $250-375/day — $1,250-1,875 per shoot just in coordinator time. Cineflow auto-generates and distributes in under 2 minutes. Contracts: DocuSign costs $25+/mo — Cineflow has built-in e-signatures. Invoicing: QuickBooks $30+/mo — Cineflow handles invoices and Stripe payment links built in. Compared to running StudioBinder Agency ($299/mo) + DocuSign ($25/mo) + QuickBooks ($30/mo) = $354/mo, Cineflow Agency at $159/mo saves $195/mo — $2,340/year. For a solo producer on Solo plan at $39/mo vs StudioBinder at $29+ for basic features, Cineflow has 10x more production-specific tools.

FEATURES — EVERY SINGLE ONE:
1. CALL SHEETS: AI-generated from project data. Auto-populates crew names, roles, contact info, call times, location details, schedule. Shareable via link, downloadable as PDF. Crew gets one link, always current. No more reprinting. Refinement tool lets you adjust AI output. Venue lookup fills location details automatically. Built at: app/(app)/projects/[id]/page.tsx, api/call-sheet/generate, api/call-sheet/pdf, api/call-sheet/refine, api/call-sheet/venue-lookup.

2. CREW MANAGEMENT: Full crew roster with roles, contacts, department. Drag-to-reorder within departments. Coverage assignment editor — assign crew to specific shoot days. Built at: app/(app)/crew/page.tsx. Coverage logic in projects/[id] page.

3. PROJECTS: Multi-project dashboard. Each project has shoot days, crew assignments, call sheets, collaborators, messages, and shot lists. Sharable collab link for clients/crew. Built at: app/(app)/projects/, api/projects/[id]/.

4. SCHEDULING / CALENDAR: Production calendar with iCal export token for syncing to Google/Apple Calendar. Automated reminders via cron. Built at: app/(app)/calendar/, api/calendar/, api/cron/calendar-reminders.

5. CONTRACTS: Create, send, and collect digital e-signatures. Certificate of insurance tracking. Built at: app/(app)/contracts/, api/contracts/ (generate, send, sign, stamp, certificate).

6. INVOICES: Create invoices with line items, send to clients, collect payment via Stripe payment link. Automated payment reminders via cron. PDF export. Built at: api/invoices/ (pdf, send, stripe-link, confirm-payment, reminders).

7. QUOTES: AI-powered quote generation — describe the project, AI generates scope and package options. Client-facing quote link. Accept flow converts to project or invoice. Built at: app/(app)/quote-calculator/, api/ai/quote-scope, api/ai/quote-packages, api/quotes/.

8. RETAINERS: Manage recurring client relationships. Monthly scope, deliverable tracking, client portal with branded link. AI retainer scope generation. Built at: app/(app)/retainers/, api/retainers/, api/retainer-portal/[token], api/ai/retainer-scope.

9. CLIENTS: Client database with project history. Client-facing portal with token-based access. Built at: app/(app)/clients/, api/client/[token].

10. BOARDS (KANBAN): Draggable kanban boards for production tasks. AI card generation. Built at: app/(app)/boards/, api/ai/board-card.

11. SCRIPTS + BREAKDOWN: Upload/paste scripts, AI-powered scene breakdown — extracts locations, cast, props, special equipment per scene. Built at: app/(app)/scripts/, api/scripts/breakdown.

12. SHOT LISTS: Structured shot list builder per project. Built at: app/(app)/shot-lists/.

13. STORYBOARD: Storyboard management with shareable link. Built at: app/(app)/storyboard/, api/storyboard-share.

14. FORMS: Custom intake/release forms. Send to crew/talent via email. Token-based response collection. Built at: app/(app)/forms/, api/forms/.

15. TASKS / PROJECT TASKS: Task management with Kanban view. Built at: app/(app)/tasks/, app/(app)/project-tasks/.

16. REVISION REVIEW: Client review portal for deliverables with frame-level feedback. Built at: api/review/[token]/.

17. FINANCE DASHBOARD: Revenue overview, invoice tracking. Built at: app/(app)/finance/.

18. TEAM: Invite team members to a workspace. Role-based access. Built at: app/(app)/team/, api/team/invite.

19. COLLAB PORTAL: Client/collaborator-facing project view — tasks, notes, schedule, shot items, files. Token-based, no login required. Built at: app/(collab)/collab/[projectId]/, api/collab/[projectId]/.

20. BROADCAST: Admin-triggered email broadcasts to user segments. Built at: app/admin/broadcast/, api/admin/broadcast.

21. IN-APP ANNOUNCEMENTS: Banner announcements shown to all users. Built at: app/admin/announcements/.

22. REFERRAL SYSTEM: Custom referral codes, referral tracking. Built at: api/referrals/code.

23. INVITE LINKS: Shareable beta invite links with usage tracking. Built at: app/admin/invite-links/, api/admin/invite-links/.

24. STUDIO BRANDING: Custom logo, colors for the workspace. Built at: api/studio-branding, api/upload/logo.

25. AI TRANSCRIPTION: Upload audio/video, AI transcribes. PDF transcription also. Built at: api/transcribe/ (route, ai, pdf, prepare).

26. AI BRIEF IMPORT: Paste a client brief, AI parses it into a structured project. Built at: api/ai/import-brief, api/admin/brief/.

27. MAC DESKTOP APP: Electron wrapper of usecineflow.com. .dmg hosted on Vercel Blob. Smart Mac-only dashboard banner (dismissible, stored in Supabase). Download tracked.

28. DEMO MODE: Full interactive demo without signup. Auto-cleans via cron. Built at: api/demo/start, api/cron/cleanup-demo.

COMPETITORS vs CINEFLOW:
StudioBinder: $29 (Indie) to $299 (Studio) per month. Call sheets, scripts, scheduling — but no invoices, no contracts, no client portals, no AI quote generation. UI feels like a form tool.
Celtx: $15-30/mo. Script writing focused. Weak on production coordination. No invoicing.
Movie Magic: Enterprise only, $400+/mo, desktop software from the 90s.
Frame.io: Review/collab only, $15-80/mo. No production management.
Cineflow Agency at $159/mo does what a $354+/mo stack does. Built by a filmmaker, for filmmakers.

═══════════════════════════════════════════════════════════
CODEBASE — FULL MAP (use read_file / search_codebase for any file)
═══════════════════════════════════════════════════════════

TECH STACK: Next.js 15 App Router, TypeScript, Tailwind CSS, Framer Motion, Supabase (auth + Postgres + storage + SSR), Anthropic Claude API (claude-sonnet-4-6 for AI features), ElevenLabs (Jarvis TTS), Stripe (billing — checkout not yet wired for subscriptions), Vercel (hosting, auto-deploys from GitHub main on push).

REPO: ${GITHUB_REPO}
KEY DIRECTORIES:
app/(app)/          — all authenticated user-facing pages (dashboard, projects, crew, call sheets, etc.)
app/(auth)/         — login, signup, forgot-password pages
app/(collab)/       — unauthenticated client/crew collab portal
app/admin/          — admin-only pages (users, analytics, broadcast, Jarvis, etc.)
app/api/            — all API routes, organized by feature
app/api/admin/      — admin-only APIs (user management, broadcast, feature flags, Jarvis)
app/api/ai/         — AI-powered generation endpoints (quote, brief, retainer, board, breakdown)
app/api/stripe/     — Stripe checkout, customer portal, webhook handler
app/api/cron/       — scheduled jobs (trial reminders, invoice reminders, calendar reminders, demo cleanup)
supabase/migrations/ — all DB schema migrations

CRITICAL FILES:
app/(app)/layout.tsx                         — app shell: nav, auth check, announcement banner, sidebar
app/(app)/dashboard/page.tsx                 — main user dashboard
app/(app)/projects/[id]/page.tsx             — project detail: call sheet builder, crew assignments, shoot days
app/(app)/crew/page.tsx                      — crew roster with drag-to-reorder
app/admin/jarvis/page.tsx                    — this voice interface (YOU are running from here)
app/api/admin/jarvis/route.ts               — this API (your brain)
app/api/admin/jarvis/sessions/route.ts       — session transcript save/retrieve
app/api/call-sheet/generate/route.ts         — AI call sheet generation
app/api/stripe/webhook/route.ts             — Stripe event handler (plan updates, cancellations)
app/api/stripe/checkout/route.ts            — subscription checkout session creation
app/api/auth/signup/route.ts               — signup flow with plan assignment

TOOLS AVAILABLE TO YOU:
get_stats — live user counts, signups, active, plan breakdown
get_revenue — MRR, ARR, lifetime deal count (currently all $0 — see lifetime context below)
get_feedback — latest user feedback
get_feature_flags — all feature flags
get_user — look up a user by email or name (only when explicitly asked)
get_referrals — referral stats
get_invite_links — invite link usage
get_audit_log — recent admin actions
send_broadcast — email a user segment
create_announcement — in-app banner
toggle_feature_flag — enable/disable features
read_file — read any file from the codebase by path
list_directory — list files in any directory
search_codebase — grep across the entire codebase for any function, string, or pattern
create_github_issue — create issues to track bugs or features
save_memory — save facts to long-term memory across sessions (use proactively, silently)
get_at_risk_users — users whose trial expires soon
get_recent_signups — recent signups with plan info
add_user_note — attach a note to a specific user's profile
get_user_notes — retrieve all notes on a specific user

CODE ACCESS STRATEGY: For any code question, use search_codebase first (fastest — returns matching lines with file paths), then read_file for full context. list_directory to explore unknown areas. You can chain: search → read → respond in one turn.

═══════════════════════════════════════════════════════════
BUSINESS CONTEXT
═══════════════════════════════════════════════════════════

LIFETIME USERS — CRITICAL CONTEXT:
The 12 "lifetime" users in the DB are ${firstName}'s personal friends and early supporters who were manually granted lifetime access for FREE — zero dollars collected. This was completely intentional. MRR = $0 is correct and expected. The Stripe billing flow to collect recurring payments has not been built yet — that is the #1 priority. The lifetime plan sitting at $0 revenue is not a bug. Never frame this as Stripe being broken in terms of the existing users. The gap is simply: no new user can pay yet because checkout hasn't been built.

CURRENT PRIORITIES:
#1 — Build Stripe subscription checkout so new signups can actually convert to paying customers
#2 — Re-engage the 12 lifetime users (friends) and get them actively using the product — they're the fastest feedback loop
#3 — Fix activation: get users logging in and hitting the "aha moment" (sharing a call sheet link and seeing it work)
Roadmap: Stripe → landing page → Google OAuth → referrals → out of beta

PRICING: Solo $39/mo | Studio $79/mo | Agency $159/mo | Enterprise $299/mo | Lifetime $299 one-time (gifted to friends for free in beta)

Time: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" })}.${dataBlock}${memoryBlock}`;

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
            case "add_user_note":       result = await executeAddUserNote(toolUse.input as any, adminId); break;
            case "get_user_notes":      result = await executeGetUserNotes(toolUse.input as any); break;
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
