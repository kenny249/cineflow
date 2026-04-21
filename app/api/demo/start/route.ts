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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0];
}
function isoFromNow(days: number, hours = 0): string {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();
}

// ─── Demo image: fetch from CDN once, cache in Supabase storage ───────────────
// Uses service role so no RLS applies. Images live at project-files/_demo/*.jpg
// and are shared across all demo accounts.
async function ensureDemoImage(supabase: AnyClient, key: string, sourceUrl: string): Promise<string> {
  const bucket = "project-files";
  const path = `_demo/${key}.jpg`;

  // Get the public URL regardless — we return it if upload succeeds or file already exists
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);

  // Check if file already uploaded
  const { data: listed } = await supabase.storage.from(bucket).list("_demo", { search: `${key}.jpg` });
  if (listed && listed.length > 0) return publicUrl;

  // Fetch + upload
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Cineflow/1.0 (demo image prefetch)" },
    });
    if (!res.ok) return "";
    const buf = await res.arrayBuffer();
    const { error } = await supabase.storage.from(bucket).upload(path, buf, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) return "";
    return publicUrl;
  } catch {
    return "";
  }
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seedDemoAccount(supabase: AnyClient, userId: string, plan: string) {

  // ── 0. Prefetch demo thumbnails (fire in parallel, non-blocking on failure) ──
  // Pexels CDN — public, no auth required, not filtered by ProjectCard
  const [protettaThumb, luminosThumb, weddingThumb] = await Promise.all([
    ensureDemoImage(supabase, "protetta",   "https://images.pexels.com/photos/1624496/pexels-photo-1624496.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750"),
    ensureDemoImage(supabase, "luminos",    "https://images.pexels.com/photos/3379934/pexels-photo-3379934.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750"),
    ensureDemoImage(supabase, "afterrain",  "https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750"),
  ]);

  // ── 1. Profile ────────────────────────────────────────────────────────────────
  await supabase.from("profiles").upsert(
    {
      id: userId,
      first_name: "Alex",
      last_name: "Rivera",
      role: "filmmaker",
      plan,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  // ── 2. Projects ───────────────────────────────────────────────────────────────

  const { data: protetta } = await supabase
    .from("projects")
    .insert({
      title: "Protetta",
      description: "A gripping psychological thriller short set in an isolated mountain cabin in the Sierra Nevada. A couple's weekend retreat unravels when they discover their host has vanished.",
      client_name: "Meridian Films",
      status: "active",
      type: "short_film",
      progress: 65,
      due_date: daysFromNow(21),
      shoot_date: daysFromNow(7),
      thumbnail_url: protettaThumb || undefined,
      created_by: userId,
      tags: ["thriller", "short_film"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  const { data: luminos } = await supabase
    .from("projects")
    .insert({
      title: "Luminos — Brand Film",
      description: "90-second cinematic brand manifesto for Luminos Studio Lighting. Shot in a converted downtown warehouse. Goal: convey craftsmanship and precision for their Pro series launch.",
      client_name: "Helm Productions",
      status: "in_review",
      type: "commercial",
      progress: 45,
      due_date: daysFromNow(14),
      shoot_date: daysFromNow(10),
      thumbnail_url: luminosThumb || undefined,
      created_by: userId,
      tags: ["commercial", "brand_film"],
      created_at: isoFromNow(-10),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  const { data: afterRain } = await supabase
    .from("projects")
    .insert({
      title: "After the Rain",
      description: "Feature-length wedding documentary for Marcus & Claire Thorne. Destination ceremony in the Ojai Valley. Includes full ceremony, reception, and a next-day portrait session.",
      client_name: "Marcus & Claire Thorne",
      status: "review",
      type: "wedding",
      progress: 88,
      due_date: daysFromNow(5),
      shoot_date: daysFromNow(-18),
      thumbnail_url: weddingThumb || undefined,
      created_by: userId,
      tags: ["wedding", "documentary"],
      created_at: isoFromNow(-25),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  const pid1 = protetta?.id;
  const pid2 = luminos?.id;
  const pid3 = afterRain?.id;

  // ── 3. Client contacts ────────────────────────────────────────────────────────
  await supabase.from("client_contacts").insert([
    {
      user_id: userId,
      client_name: "Meridian Films",
      contact_name: "Sarah Chen",
      email: "sarah@meridianfilms.com",
      phone: "(310) 555-0192",
      notes: "Key contact for Protetta. Prefers email for project updates.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      client_name: "Helm Productions",
      contact_name: "Derek Walsh",
      email: "d.walsh@helmproductions.com",
      phone: "(424) 555-0871",
      notes: "Creative director. Usually responsive same day. Likes concise Loom walkthroughs instead of long email threads.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      client_name: "Marcus & Claire Thorne",
      contact_name: "Claire Thorne",
      email: "claire.thorne@gmail.com",
      phone: "(805) 555-0334",
      notes: "Bride. Marcus handles billing questions. Claire is the primary point of contact for creative decisions.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);

  // ── 4. Invoices ───────────────────────────────────────────────────────────────
  const inv = (overrides: object) => ({
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    amount_paid: 0,
    ...overrides,
  });

  await supabase.from("invoices").insert([
    // Protetta: pre-production — paid
    inv({
      project_id: pid1,
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
    // Protetta: principal photography — sent, awaiting payment
    inv({
      project_id: pid1,
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
    // Luminos: brand film — draft
    inv({
      project_id: pid2,
      invoice_number: "INV-0003",
      client_name: "Helm Productions",
      client_email: "d.walsh@helmproductions.com",
      description: "Brand Film Production — Luminos",
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
    // After the Rain — 50% deposit paid
    inv({
      project_id: pid3,
      invoice_number: "INV-0004",
      client_name: "Marcus & Claire Thorne",
      client_email: "claire.thorne@gmail.com",
      description: "Wedding Film — After the Rain (50% deposit)",
      amount: 2250,
      amount_paid: 2250,
      status: "paid",
      invoice_date: daysFromNow(-60),
      due_date: daysFromNow(-45),
      paid_date: daysFromNow(-44),
      line_items: [
        { id: crypto.randomUUID(), description: "Deposit — 50% of total", quantity: 1, rate: 2250 },
      ],
    }),
    // After the Rain — balance on delivery
    inv({
      project_id: pid3,
      invoice_number: "INV-0005",
      client_name: "Marcus & Claire Thorne",
      client_email: "claire.thorne@gmail.com",
      description: "Wedding Film — After the Rain (balance on delivery)",
      amount: 2250,
      status: "sent",
      invoice_date: daysFromNow(-2),
      due_date: daysFromNow(5),
      line_items: [
        { id: crypto.randomUUID(), description: "Balance — 50% on delivery", quantity: 1, rate: 2250 },
      ],
    }),
  ]);

  // ── 5. Calendar events ────────────────────────────────────────────────────────
  const events = [];
  if (pid1) {
    events.push(
      {
        created_by: userId,
        project_id: pid1,
        title: "Protetta — Location Scout",
        event_type: "shoot",
        start_time: isoFromNow(-7, 8),
        end_time: isoFromNow(-7, 18),
        location: "Sierra Nevada, CA",
      },
      {
        created_by: userId,
        project_id: pid1,
        title: "Protetta — Client Review Call",
        event_type: "meeting",
        start_time: isoFromNow(3, 10),
        end_time: isoFromNow(3, 11),
      },
      {
        created_by: userId,
        project_id: pid1,
        title: "Protetta — Principal Photography Day 1",
        event_type: "shoot",
        start_time: isoFromNow(7, 7),
        end_time: isoFromNow(7, 19),
        location: "Big Bear Lake, CA",
      }
    );
  }
  if (pid2) {
    events.push({
      created_by: userId,
      project_id: pid2,
      title: "Luminos — Studio Shoot Day",
      event_type: "shoot",
      start_time: isoFromNow(10, 8),
      end_time: isoFromNow(10, 18),
      location: "The Warehouse Studio, DTLA",
    });
  }
  if (pid3) {
    events.push({
      created_by: userId,
      project_id: pid3,
      title: "After the Rain — Final Delivery Meeting",
      event_type: "meeting",
      start_time: isoFromNow(4, 14),
      end_time: isoFromNow(4, 15),
    });
  }
  if (events.length) await supabase.from("calendar_events").insert(events);

  // ── 6. Tasks ──────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  await supabase.from("tasks").insert([
    { user_id: userId, title: "Lock final cut — Protetta", priority: "high",   date: today, done: false },
    { user_id: userId, title: "Send INV-0002 to Meridian Films",      priority: "high",   date: today, done: false },
    { user_id: userId, title: "Color grade session — Luminos",        priority: "medium", date: today, done: true  },
    { user_id: userId, title: "Review client notes — After the Rain", priority: "medium", date: today, done: false },
    { user_id: userId, title: "Export call sheet — Day 1 shoot",      priority: "low",    date: today, done: true  },
  ]);

  // ── 7. Revisions — use Google's public sample videos so the player works ──────
  // Short clips keep demo snappy; file_size shows realistic metadata.
  const SAMPLE_VIDEO_A = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  const SAMPLE_VIDEO_B = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4";

  const revisions = [];
  if (pid1) {
    revisions.push(
      {
        project_id: pid1,
        created_by: userId,
        title: "Rough Cut",
        status: "approved",
        version_number: 1,
        file_url: SAMPLE_VIDEO_A,
        file_type: "video/mp4",
        file_size: 2254857830,
        created_at: isoFromNow(-14),
        updated_at: isoFromNow(-12),
      },
      {
        project_id: pid1,
        created_by: userId,
        title: "Director's Cut",
        status: "revisions_requested",
        version_number: 2,
        file_url: SAMPLE_VIDEO_B,
        file_type: "video/mp4",
        file_size: 1932735283,
        feedback: "Pacing in the second act feels slow — tighten the cabin interior sequence. Also, the score mix is too loud in the final minute.",
        created_at: isoFromNow(-6),
        updated_at: isoFromNow(-4),
      },
      {
        project_id: pid1,
        created_by: userId,
        title: "Final Polish",
        status: "draft",
        version_number: 3,
        file_url: SAMPLE_VIDEO_A,
        file_type: "video/mp4",
        file_size: 1503238553,
        created_at: isoFromNow(-1),
        updated_at: isoFromNow(-1),
      }
    );
  }
  if (pid2) {
    revisions.push({
      project_id: pid2,
      created_by: userId,
      title: "First Assembly",
      status: "in_review",
      version_number: 1,
      file_url: SAMPLE_VIDEO_B,
      file_type: "video/mp4",
      file_size: 3758096384,
      created_at: isoFromNow(-3),
      updated_at: isoFromNow(-3),
    });
  }
  if (pid3) {
    revisions.push(
      {
        project_id: pid3,
        created_by: userId,
        title: "Ceremony Edit",
        status: "approved",
        version_number: 1,
        file_url: SAMPLE_VIDEO_A,
        file_type: "video/mp4",
        file_size: 5368709120,
        created_at: isoFromNow(-12),
        updated_at: isoFromNow(-10),
      },
      {
        project_id: pid3,
        created_by: userId,
        title: "Full Feature — Final",
        status: "approved",
        version_number: 2,
        file_url: SAMPLE_VIDEO_B,
        file_type: "video/mp4",
        file_size: 8589934592,
        created_at: isoFromNow(-5),
        updated_at: isoFromNow(-3),
      }
    );
  }
  if (revisions.length) await supabase.from("revisions").insert(revisions);

  // ── 8. Team members ───────────────────────────────────────────────────────────
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

  // ── 9. Retainer — Helm Productions ongoing social content ─────────────────────
  const monthStart = new Date();
  monthStart.setDate(1);
  await supabase.from("retainers").insert({
    created_by: userId,
    client_name: "Helm Productions",
    monthly_rate: 3500,
    is_active: true,
    start_date: monthStart.toISOString().split("T")[0],
    notes: "Monthly retainer for ongoing commercial content. Deliverables reset on the 1st.",
    template: [
      { type: "short", label: "Short-form Videos (60s)", quantity: 4, mode: "individual" },
      { type: "photo", label: "Photo Session", quantity: 1, mode: "batch" },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
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

    const tempEmail = `demo-${crypto.randomUUID()}@demo.usecineflow.com`;
    const tempPassword = crypto.randomUUID();
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
    await seedDemoAccount(supabase as AnyClient, userId, plan);

    return NextResponse.json({ email: tempEmail, password: tempPassword });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", detail: msg }, { status: 500 });
  }
}
