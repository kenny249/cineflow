import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── IP-based rate limiter — max 3 demo sessions per IP per hour ──────────────
const ipLog = new Map<string, number[]>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const hits = (ipLog.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= 3) return true;
  ipLog.set(ip, [...hits, now]);
  return false;
}

// ─── Admin client (service role — never sent to browser) ─────────────────────
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Untyped alias so table operations don't fail on missing generated schema types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0];
}
function isoFromNow(days: number, hours = 0): string {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seedDemoAccount(supabase: AnyClient, userId: string, plan: string) {
  // 1. Profile — only use real columns (first_name, last_name, role, plan)
  await supabase.from("profiles").upsert(
    {
      id: userId,
      first_name: "Demo",
      last_name: "User",
      role: "filmmaker",
      plan,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  // 2. Project — Protetta
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({
      title: "Protetta",
      description:
        "A gripping psychological thriller short set in an isolated mountain cabin in the Sierra Nevada. A couple's weekend retreat unravels when they discover their host has vanished.",
      client_name: "Meridian Films",
      status: "active",
      type: "short_film",
      progress: 45,
      due_date: daysFromNow(21),
      shoot_date: daysFromNow(7),
      created_by: userId,
      tags: ["thriller", "short_film"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (projErr || !project) {
    return;
  }

  const pid = project.id;

  // 3. Client contact — no city/state columns in schema
  await supabase.from("client_contacts").insert({
    user_id: userId,
    client_name: "Meridian Films",
    contact_name: "Sarah Chen",
    email: "sarah@meridianfilms.com",
    phone: "(310) 555-0192",
    notes: "Key contact for Protetta. Prefers email for project updates.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // 4. Invoices
  const inv = (overrides: object) => ({
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    amount_paid: 0,
    ...overrides,
  });

  await supabase.from("invoices").insert([
    inv({
      project_id: pid,
      invoice_number: "INV-0001",
      client_name: "Meridian Films",
      client_email: "sarah@meridianfilms.com",
      description: "Pre-Production Services — Protetta",
      amount: 3500,
      amount_paid: 3500,
      status: "paid",
      invoice_date: daysFromNow(-30),
      due_date: daysFromNow(-15),
      paid_date: daysFromNow(-10),
      line_items: [
        { id: crypto.randomUUID(), description: "Director + DP pre-production", quantity: 1, rate: 2000 },
        { id: crypto.randomUUID(), description: "Location scouting (2 days)", quantity: 2, rate: 500 },
        { id: crypto.randomUUID(), description: "Script supervision", quantity: 1, rate: 500 },
      ],
    }),
    inv({
      project_id: pid,
      invoice_number: "INV-0002",
      client_name: "Meridian Films",
      client_email: "sarah@meridianfilms.com",
      description: "Principal Photography — Protetta",
      amount: 8200,
      status: "sent",
      invoice_date: daysFromNow(-5),
      due_date: daysFromNow(25),
      line_items: [
        { id: crypto.randomUUID(), description: "Director fee (3-day shoot)", quantity: 3, rate: 1500 },
        { id: crypto.randomUUID(), description: "Cinematographer (3-day shoot)", quantity: 3, rate: 1200 },
        { id: crypto.randomUUID(), description: "Crew (3 days)", quantity: 3, rate: 500 },
        { id: crypto.randomUUID(), description: "Post-production supervision", quantity: 1, rate: 700 },
      ],
    }),
    inv({
      invoice_number: "INV-0003",
      client_name: "Helm Productions",
      client_email: "contact@helmproductions.com",
      description: "Commercial — Summer Campaign",
      amount: 4750,
      status: "draft",
      invoice_date: daysFromNow(0),
      due_date: daysFromNow(30),
      line_items: [
        { id: crypto.randomUUID(), description: "Production fee", quantity: 1, rate: 3500 },
        { id: crypto.randomUUID(), description: "Color grade", quantity: 1, rate: 750 },
        { id: crypto.randomUUID(), description: "Sound mix", quantity: 1, rate: 500 },
      ],
    }),
  ]);

  // 5. Calendar events — DB uses start_time/end_time (TIMESTAMPTZ NOT NULL), not start_date/all_day
  await supabase.from("calendar_events").insert([
    {
      created_by: userId,
      project_id: pid,
      title: "Protetta — Location Scout",
      event_type: "shoot",
      start_time: isoFromNow(-7, 8),
      end_time: isoFromNow(-7, 18),
      location: "Sierra Nevada, CA",
    },
    {
      created_by: userId,
      project_id: pid,
      title: "Protetta — Client Review Call",
      event_type: "meeting",
      start_time: isoFromNow(3, 10),
      end_time: isoFromNow(3, 11),
    },
    {
      created_by: userId,
      project_id: pid,
      title: "Protetta — Principal Photography Day 1",
      event_type: "shoot",
      start_time: isoFromNow(7, 8),
      end_time: isoFromNow(7, 19),
      location: "Big Bear Lake, CA",
    },
  ]);

  // 6. Tasks — fun onboarding tasks that double as a product tour
  const today = new Date().toISOString().split("T")[0];
  await supabase.from("tasks").insert([
    { user_id: userId, title: "Open Tasks Page", priority: "low",    date: today, done: true  },
    { user_id: userId, title: "Think",           priority: "medium", date: today, done: true  },
    { user_id: userId, title: "wait CineFlow is kinda sick!", priority: "high", date: today, done: false },
    { user_id: userId, title: "Give Beta Feedback",           priority: "high", date: today, done: false },
  ]);

  // 7. Team members — Protetta crew
  await supabase.from("team_members").insert([
    {
      invited_by: userId,
      email: "maya@meridianfilms.com",
      name: "Maya Rodriguez",
      role: "admin",
      status: "active",
      invited_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
    },
    {
      invited_by: userId,
      email: "james.obrien@crew.com",
      name: "James O'Brien",
      role: "member",
      status: "active",
      invited_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
    },
    {
      invited_by: userId,
      email: "sarah@meridianfilms.com",
      name: "Sarah Chen",
      role: "member",
      status: "pending",
      invited_at: new Date().toISOString(),
    },
  ]);
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many demo requests. Try again in an hour." }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const VALID_PLANS = ["solo_beta", "studio_beta"];
    const plan: string = VALID_PLANS.includes(body.plan) ? body.plan : "studio_beta";

    const supabase = getAdminClient();

    // 1. Create ephemeral user with a random password (email pre-confirmed, no real email sent)
    const tempEmail = `demo-${crypto.randomUUID()}@demo.usecineflow.com`;
    const tempPassword = crypto.randomUUID(); // one-time, returned over HTTPS, account expires in 24h
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: tempEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { is_demo: true, plan, demo_created_at: new Date().toISOString() },
    });

    if (createError || !createData.user) {
      return NextResponse.json({ error: "Could not create demo session", detail: createError?.message }, { status: 500 });
    }

    const userId = createData.user.id;

    // 2. Seed fake data
    await seedDemoAccount(supabase as AnyClient, userId, plan);

    // 3. Return credentials — client signs in directly via signInWithPassword.
    //    No magic link redirect needed; avoids the #access_token hash fragment issue.
    return NextResponse.json({ email: tempEmail, password: tempPassword });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", detail: msg }, { status: 500 });
  }
}
