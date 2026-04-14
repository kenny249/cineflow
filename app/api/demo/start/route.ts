import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
async function seedDemoAccount(supabase: AnyClient, userId: string, tempEmail: string, plan: string) {
  // 1. Profile
  await supabase.from("profiles").upsert(
    {
      id: userId,
      email: tempEmail,
      full_name: "Demo User",
      business_name: "Demo Studio",
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
      owner_id: userId,
      tags: ["thriller", "short_film"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (projErr || !project) return; // non-fatal — rest of seed still runs below

  const pid = project.id;

  // 3. Client contact
  await supabase.from("client_contacts").insert({
    user_id: userId,
    client_name: "Meridian Films",
    contact_name: "Sarah Chen",
    email: "sarah@meridianfilms.com",
    phone: "(310) 555-0192",
    city: "Los Angeles",
    state: "CA",
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

  // 5. Calendar events
  await supabase.from("calendar_events").insert([
    {
      created_by: userId,
      project_id: pid,
      title: "Protetta — Location Scout",
      type: "shoot",
      event_type: "shoot",
      start_date: daysFromNow(-7),
      all_day: true,
      location: "Sierra Nevada, CA",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      created_by: userId,
      project_id: pid,
      title: "Protetta — Client Review Call",
      type: "meeting",
      event_type: "meeting",
      start_date: daysFromNow(3),
      start_time: isoFromNow(3, 10),
      end_time: isoFromNow(3, 11),
      all_day: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      created_by: userId,
      project_id: pid,
      title: "Protetta — Principal Photography Day 1",
      type: "shoot",
      event_type: "shoot",
      start_date: daysFromNow(7),
      all_day: true,
      location: "Big Bear Lake, CA",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const plan: string = body.plan ?? "studio_beta";

    const supabase = getAdminClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      req.headers.get("origin") ??
      "https://www.usecineflow.com";

    // 1. Create ephemeral user (email pre-confirmed, no real email sent)
    const tempEmail = `demo-${crypto.randomUUID()}@demo.usecineflow.com`;
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: tempEmail,
      email_confirm: true,
      user_metadata: { is_demo: true, plan, demo_created_at: new Date().toISOString() },
    });

    if (createError || !createData.user) {
      console.error("[demo/start] createUser failed:", createError?.message);
      return NextResponse.json({ error: "Could not create demo session", detail: createError?.message }, { status: 500 });
    }

    const userId = createData.user.id;

    // 2. Seed fake data (non-blocking errors — demo still works without perfect seed)
    await seedDemoAccount(supabase as AnyClient, userId, tempEmail, plan);

    // 3. Generate a one-time magic link so the client can sign in without a password
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: tempEmail,
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[demo/start] generateLink failed:", linkError?.message);
      // Clean up orphaned user so it doesn't accumulate
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Could not generate demo link", detail: linkError?.message }, { status: 500 });
    }

    return NextResponse.json({ action_link: linkData.properties.action_link });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[demo/start] unexpected error:", msg);
    return NextResponse.json({ error: "Internal server error", detail: msg }, { status: 500 });
  }
}
