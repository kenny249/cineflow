import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export interface ActivityEvent {
  id: string;
  type: "signup" | "project" | "invoice" | "contract" | "plan_change" | "portal" | "revision" | "review" | "comment";
  label: string;
  detail?: string;
  ts: string;
}

export async function GET(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = req.nextUrl.searchParams.get("since");
  const cutoff = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const admin = getAdmin();

  const [
    { data: { users: authUsers } },
    { data: profiles },
    { data: projects },
    { data: invoices },
    { data: contracts },
    { data: portals },
    { data: revisions },
    { data: comments },
    { data: projectsAll },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, first_name, last_name, plan, plan_status, updated_at").gte("updated_at", cutoff),
    admin.from("projects").select("id, title, created_by, created_at").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(50),
    admin.from("invoices").select("id, invoice_number, status, created_by, created_at").gte("created_at", cutoff).in("status", ["sent", "paid"]).order("created_at", { ascending: false }).limit(50),
    admin.from("contracts").select("id, title, status, created_by, created_at").gte("created_at", cutoff).in("status", ["signed", "sent"]).order("created_at", { ascending: false }).limit(50),
    // Review portals: created OR viewed by a client in the window
    admin.from("review_tokens").select("id, client_name, project_id, created_at, last_viewed_at").or(`created_at.gte.${cutoff},last_viewed_at.gte.${cutoff}`).limit(50),
    // Revisions: uploaded, approved, or changes requested in the window
    admin.from("revisions").select("id, title, status, project_id, created_at, updated_at").gte("updated_at", cutoff).order("updated_at", { ascending: false }).limit(50),
    // Client comments left in the window
    admin.from("revision_comments").select("id, author_name, revision_id, created_at").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(50),
    // Lightweight project map for attributing review/portal activity to an owner
    admin.from("projects").select("id, title, created_by"),
  ]);

  const projMap = Object.fromEntries((projectsAll ?? []).map((p) => [p.id, { title: p.title as string | null, owner: p.created_by as string | null }]));
  const revToProject = Object.fromEntries((revisions ?? []).map((r) => [r.id, r.project_id]));

  const emailMap = Object.fromEntries(
    (authUsers ?? [])
      .filter((u) => !u.email?.endsWith("@demo.usecineflow.com"))
      .map((u) => [u.id, u.email ?? ""])
  );

  const nameMap = Object.fromEntries(
    (profiles ?? []).map((p) => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(" ") || emailMap[p.id]?.split("@")[0] || "User",
    ])
  );

  const events: ActivityEvent[] = [];

  // New signups
  for (const u of (authUsers ?? []).filter((u) => !u.email?.endsWith("@demo.usecineflow.com") && u.created_at >= cutoff)) {
    events.push({
      id: `signup-${u.id}`,
      type: "signup",
      label: "New signup",
      detail: u.email,
      ts: u.created_at,
    });
  }

  // New projects
  for (const p of projects ?? []) {
    const who = nameMap[p.created_by] ?? emailMap[p.created_by] ?? "Unknown";
    events.push({
      id: `project-${p.id}`,
      type: "project",
      label: "Project created",
      detail: `${p.title ?? "Untitled"} by ${who}`,
      ts: p.created_at,
    });
  }

  // Invoices sent/paid
  for (const inv of invoices ?? []) {
    const who = nameMap[inv.created_by] ?? emailMap[inv.created_by] ?? "Unknown";
    events.push({
      id: `invoice-${inv.id}`,
      type: "invoice",
      label: inv.status === "paid" ? "Invoice paid" : "Invoice sent",
      detail: `${inv.invoice_number ?? "Invoice"} by ${who}`,
      ts: inv.created_at,
    });
  }

  // Contracts signed
  for (const c of contracts ?? []) {
    const who = nameMap[c.created_by] ?? emailMap[c.created_by] ?? "Unknown";
    events.push({
      id: `contract-${c.id}`,
      type: "contract",
      label: c.status === "signed" ? "Contract signed" : "Contract sent",
      detail: `${c.title ?? "Contract"} by ${who}`,
      ts: c.created_at,
    });
  }

  const ownerName = (id: string | null | undefined) => (id && (nameMap[id] ?? emailMap[id]?.split("@")[0])) || "a user";
  const projTitle = (id: string | null | undefined) => (id && projMap[id]?.title) || "a project";

  // Review portals — created + client views
  for (const p of portals ?? []) {
    const title = projTitle(p.project_id);
    if (p.created_at >= cutoff) {
      events.push({ id: `portal-new-${p.id}`, type: "portal", label: "Client portal created", detail: `${title} → ${p.client_name ?? "client"} (by ${ownerName(projMap[p.project_id ?? ""]?.owner)})`, ts: p.created_at });
    }
    if (p.last_viewed_at && p.last_viewed_at >= cutoff) {
      events.push({ id: `portal-view-${p.id}`, type: "portal", label: "Client viewed portal", detail: `${p.client_name ?? "Client"} opened ${title}`, ts: p.last_viewed_at });
    }
  }

  // Revisions — uploaded, approved, changes requested
  for (const r of revisions ?? []) {
    if (r.created_at >= cutoff) {
      events.push({ id: `rev-new-${r.id}`, type: "revision", label: "Cut uploaded", detail: `${r.title ?? "Revision"} on ${projTitle(r.project_id)} (by ${ownerName(projMap[r.project_id ?? ""]?.owner)})`, ts: r.created_at });
    }
    if (r.updated_at >= cutoff && (r.status === "approved" || r.status === "revisions_requested")) {
      events.push({
        id: `rev-status-${r.id}`,
        type: "review",
        label: r.status === "approved" ? "Client approved a cut" : "Client requested changes",
        detail: `${r.title ?? "Revision"} on ${projTitle(r.project_id)}`,
        ts: r.updated_at,
      });
    }
  }

  // Client comments
  for (const c of comments ?? []) {
    const pid = revToProject[c.revision_id];
    events.push({ id: `comment-${c.id}`, type: "comment", label: "Client left a comment", detail: `${c.author_name ?? "Client"} on ${projTitle(pid)}`, ts: c.created_at });
  }

  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return NextResponse.json({ events: events.slice(0, 100) });
}
