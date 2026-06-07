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
  type: "signup" | "project" | "invoice" | "contract" | "plan_change";
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
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, first_name, last_name, plan, plan_status, updated_at").gte("updated_at", cutoff),
    admin.from("projects").select("id, title, created_by, created_at").gte("created_at", cutoff).order("created_at", { ascending: false }).limit(50),
    admin.from("invoices").select("id, invoice_number, status, created_by, created_at").gte("created_at", cutoff).in("status", ["sent", "paid"]).order("created_at", { ascending: false }).limit(50),
    admin.from("contracts").select("id, title, status, created_by, created_at").gte("created_at", cutoff).in("status", ["signed", "sent"]).order("created_at", { ascending: false }).limit(50),
  ]);

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

  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return NextResponse.json({ events: events.slice(0, 100) });
}
