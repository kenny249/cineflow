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

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);

  const { data: listed } = await supabase.storage.from(bucket).list("_demo", { search: `${key}.jpg` });
  if (listed && listed.length > 0) return publicUrl;

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

// ─── Reliable public demo videos — W3C media server, supports range requests ──
// All return HTTP 206 on range requests so the video player can scrub.
const DEMO_VIDEO = {
  A: "https://media.w3.org/2010/05/sintel/trailer.mp4",       // ~5MB, cinematic trailer
  B: "https://media.w3.org/2010/05/bunny/trailer.mp4",        // ~5MB, animation
  C: "https://media.w3.org/2010/05/video/movie_300.mp4",      // ~2MB, short clip
  D: "https://media.w3.org/2010/05/bunny/movie.mp4",          // ~60MB, full short film
};

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seedDemoAccount(supabase: AnyClient, userId: string, plan: string) {

  // ── 0. Prefetch demo thumbnails ──────────────────────────────────────────────
  const [protettaThumb, luminosThumb, weddingThumb] = await Promise.all([
    ensureDemoImage(supabase, "protetta",  "https://images.pexels.com/photos/1624496/pexels-photo-1624496.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750"),
    ensureDemoImage(supabase, "luminos",   "https://images.pexels.com/photos/3379934/pexels-photo-3379934.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750"),
    ensureDemoImage(supabase, "afterrain", "https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750"),
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
        created_by: userId, project_id: pid1,
        title: "Protetta — Location Scout",
        event_type: "shoot",
        start_time: isoFromNow(-7, 8), end_time: isoFromNow(-7, 18),
        location: "Sierra Nevada, CA",
      },
      {
        created_by: userId, project_id: pid1,
        title: "Protetta — Client Review Call",
        event_type: "meeting",
        start_time: isoFromNow(3, 10), end_time: isoFromNow(3, 11),
      },
      {
        created_by: userId, project_id: pid1,
        title: "Protetta — Principal Photography Day 1",
        event_type: "shoot",
        start_time: isoFromNow(7, 7), end_time: isoFromNow(7, 19),
        location: "Big Bear Lake, CA",
      },
      {
        created_by: userId, project_id: pid1,
        title: "Protetta — Principal Photography Day 2",
        event_type: "shoot",
        start_time: isoFromNow(8, 7), end_time: isoFromNow(8, 18),
        location: "Big Bear Lake, CA",
      }
    );
  }
  if (pid2) {
    events.push(
      {
        created_by: userId, project_id: pid2,
        title: "Luminos — Pre-Production Call",
        event_type: "meeting",
        start_time: isoFromNow(5, 14), end_time: isoFromNow(5, 15),
      },
      {
        created_by: userId, project_id: pid2,
        title: "Luminos — Studio Shoot Day",
        event_type: "shoot",
        start_time: isoFromNow(10, 8), end_time: isoFromNow(10, 18),
        location: "The Warehouse Studio, DTLA",
      },
      {
        created_by: userId, project_id: pid2,
        title: "Luminos — Color Grade Session",
        event_type: "deadline",
        start_time: isoFromNow(18, 10), end_time: isoFromNow(18, 14),
      }
    );
  }
  if (pid3) {
    events.push(
      {
        created_by: userId, project_id: pid3,
        title: "After the Rain — Music Licensing Call",
        event_type: "meeting",
        start_time: isoFromNow(2, 11), end_time: isoFromNow(2, 12),
      },
      {
        created_by: userId, project_id: pid3,
        title: "After the Rain — Final Delivery Meeting",
        event_type: "meeting",
        start_time: isoFromNow(4, 14), end_time: isoFromNow(4, 15),
      },
      {
        created_by: userId, project_id: pid3,
        title: "After the Rain — Delivery Deadline",
        event_type: "deadline",
        start_time: isoFromNow(5, 9), end_time: isoFromNow(5, 9),
      }
    );
  }
  if (events.length) await supabase.from("calendar_events").insert(events);

  // ── 6. To-Do Tasks ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = daysFromNow(1);
  const nextWeek = daysFromNow(7);
  await supabase.from("tasks").insert([
    { user_id: userId, title: "Lock final cut — Protetta",          priority: "high",   date: today,     done: false },
    { user_id: userId, title: "Send INV-0002 to Meridian Films",    priority: "high",   date: today,     done: false },
    { user_id: userId, title: "Color grade session — Luminos",      priority: "medium", date: today,     done: true  },
    { user_id: userId, title: "Review client notes — After the Rain", priority: "medium", date: today,   done: false },
    { user_id: userId, title: "Export call sheet — Day 1 shoot",    priority: "low",    date: today,     done: true  },
    { user_id: userId, title: "Confirm gear rental — Protetta",     priority: "high",   date: tomorrow,  done: false },
    { user_id: userId, title: "Upload ceremony cut for review",      priority: "medium", date: tomorrow,  done: false },
    { user_id: userId, title: "Chase music licensing — After the Rain", priority: "medium", date: tomorrow, done: false },
    { user_id: userId, title: "Update shot list — Luminos Day 2",   priority: "low",    date: nextWeek,  done: false },
    { user_id: userId, title: "Book accommodation — Sierra Nevada shoot", priority: "low", date: nextWeek, done: false },
  ]);

  // ── 7. Revisions — W3C media server (supports range requests, CORS-friendly) ──
  const revisions = [];
  if (pid1) {
    revisions.push(
      {
        project_id: pid1, created_by: userId,
        title: "Rough Cut",
        status: "approved",
        version_number: 1,
        file_url: DEMO_VIDEO.A,
        file_type: "video/mp4",
        file_size: 5242880,
        created_at: isoFromNow(-14),
        updated_at: isoFromNow(-12),
      },
      {
        project_id: pid1, created_by: userId,
        title: "Director's Cut",
        status: "revisions_requested",
        version_number: 2,
        file_url: DEMO_VIDEO.C,
        file_type: "video/mp4",
        file_size: 2097152,
        feedback: "Pacing in the second act feels slow — tighten the cabin interior sequence. Also, the score mix is too loud in the final minute.",
        created_at: isoFromNow(-6),
        updated_at: isoFromNow(-4),
      },
      {
        project_id: pid1, created_by: userId,
        title: "Final Polish",
        status: "draft",
        version_number: 3,
        file_url: DEMO_VIDEO.B,
        file_type: "video/mp4",
        file_size: 5242880,
        created_at: isoFromNow(-1),
        updated_at: isoFromNow(-1),
      }
    );
  }
  if (pid2) {
    revisions.push(
      {
        project_id: pid2, created_by: userId,
        title: "First Assembly",
        status: "in_review",
        version_number: 1,
        file_url: DEMO_VIDEO.C,
        file_type: "video/mp4",
        file_size: 2097152,
        created_at: isoFromNow(-3),
        updated_at: isoFromNow(-3),
      },
      {
        project_id: pid2, created_by: userId,
        title: "Cut v2 — Pacing Fixes",
        status: "draft",
        version_number: 2,
        file_url: DEMO_VIDEO.A,
        file_type: "video/mp4",
        file_size: 5242880,
        created_at: isoFromNow(-1),
        updated_at: isoFromNow(-1),
      }
    );
  }
  if (pid3) {
    revisions.push(
      {
        project_id: pid3, created_by: userId,
        title: "Ceremony Edit",
        status: "approved",
        version_number: 1,
        file_url: DEMO_VIDEO.B,
        file_type: "video/mp4",
        file_size: 5242880,
        created_at: isoFromNow(-12),
        updated_at: isoFromNow(-10),
      },
      {
        project_id: pid3, created_by: userId,
        title: "Full Feature — Final",
        status: "approved",
        version_number: 2,
        file_url: DEMO_VIDEO.A,
        file_type: "video/mp4",
        file_size: 5242880,
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

  // ── 9. Retainer — Helm Productions ───────────────────────────────────────────
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

  // ── 10. Crew profiles — private book ─────────────────────────────────────────
  await supabase.from("crew_profiles").insert([
    {
      added_by: userId,
      name: "Jordan Lee",
      primary_role: "Director of Photography (DP)",
      roles: ["Director of Photography (DP)", "Camera Operator"],
      city: "Los Angeles",
      state: "CA",
      country: "US",
      email: "jordan.lee@dpwork.com",
      phone: "(310) 555-0241",
      bio: "10 years shooting narrative and commercial work. Strong with natural light and handheld. ARRI ALEXA Mini LF owner-operator.",
      notes: "Best DP I've worked with. Fast on set, never misses a shot. Great with clients.",
      rating: 5,
      skills: ["Handheld", "Natural Light", "Color Science", "On-set Leadership"],
      gear: ["ARRI ALEXA Mini LF", "Zeiss Supreme Primes", "DJI Ronin"],
      day_rate_min: 1200,
      day_rate_max: 1800,
      availability: "available",
      is_public: false,
      is_claimed: false,
      created_at: isoFromNow(-30),
      updated_at: isoFromNow(-30),
    },
    {
      added_by: userId,
      name: "Keisha Monroe",
      primary_role: "Editor",
      roles: ["Editor", "Colorist"],
      city: "Atlanta",
      state: "GA",
      country: "US",
      email: "keisha@posthaus.co",
      phone: "(404) 555-0819",
      bio: "Narrative editor and colorist. Specializes in documentary and wedding film. Fast turnaround without sacrificing story.",
      notes: "Go-to for anything needing a quick but polished cut. Great communicator.",
      rating: 4,
      skills: ["Premiere Pro", "DaVinci Resolve", "Storytelling", "Music Sync"],
      gear: ["Mac Pro", "DaVinci Resolve Studio"],
      day_rate_min: 600,
      day_rate_max: 900,
      availability: "booked",
      is_public: false,
      is_claimed: false,
      created_at: isoFromNow(-20),
      updated_at: isoFromNow(-20),
    },
    {
      added_by: userId,
      name: "Marcus Bell",
      primary_role: "Gaffer",
      roles: ["Gaffer"],
      city: "Los Angeles",
      state: "CA",
      country: "US",
      email: "marcus.bell@gaffer.la",
      phone: "(213) 555-0447",
      notes: "Extremely reliable. Has his own truck with full lighting package. Knows how to stretch a small lighting budget.",
      rating: 5,
      skills: ["HMI", "LED", "Grip & Electric", "Budget Lighting"],
      gear: ["Arri SkyPanel S60", "4x4 Kino Flo", "Full Grip Package"],
      day_rate_min: 700,
      day_rate_max: 1100,
      availability: "available",
      is_public: false,
      is_claimed: false,
      created_at: isoFromNow(-45),
      updated_at: isoFromNow(-45),
    },
    {
      added_by: userId,
      name: "Priya Nair",
      primary_role: "Sound Mixer / Recordist",
      roles: ["Sound Mixer / Recordist"],
      city: "New York",
      state: "NY",
      country: "US",
      email: "priya@nairsound.com",
      phone: "(718) 555-0338",
      bio: "Production sound mixer with 8 years on indie features, documentaries, and commercials. Invisible on set, pristine audio.",
      notes: "Met her on the Meridian project. Exceptional ears. Pre-wires talent fast.",
      rating: 5,
      skills: ["Boom Operation", "Wireless Lavs", "Production Sound", "Post Cleanup"],
      gear: ["Sound Devices 833", "Sennheiser MKH416", "Lectrosonics Wireless"],
      day_rate_min: 650,
      day_rate_max: 950,
      availability: "available",
      is_public: false,
      is_claimed: false,
      created_at: isoFromNow(-15),
      updated_at: isoFromNow(-15),
    },
    {
      added_by: userId,
      name: "Tyler Oaks",
      primary_role: "Drone / Aerial Operator",
      roles: ["Drone / Aerial Operator", "Camera Operator"],
      city: "San Diego",
      state: "CA",
      country: "US",
      email: "tyler@skyworksmedia.com",
      phone: "(619) 555-0562",
      notes: "FAA Part 107 certified. Fast turnaround on permits. Smooth operator — no jerky footage.",
      rating: 4,
      skills: ["DJI Inspire 3", "Part 107", "Coastal Permits", "FPV"],
      gear: ["DJI Inspire 3", "DJI Mavic 3 Cine", "FPV Racing Drone"],
      day_rate_min: 800,
      day_rate_max: 1200,
      availability: "available",
      is_public: false,
      is_claimed: false,
      created_at: isoFromNow(-8),
      updated_at: isoFromNow(-8),
    },
    {
      added_by: userId,
      name: "Sofia Reyes",
      primary_role: "1st AC / Focus Puller",
      roles: ["1st AC / Focus Puller"],
      city: "Los Angeles",
      state: "CA",
      country: "US",
      email: "sofia.reyes.1ac@gmail.com",
      phone: "(323) 555-0773",
      notes: "Jordan recommended her. Haven't worked together yet but her reel looks strong.",
      rating: 0,
      skills: ["Focus Pulling", "ARRI", "Sony Venice", "Preston MDR"],
      gear: ["Preston MDR4", "Nucleus-M", "Full AC Kit"],
      day_rate_min: 450,
      day_rate_max: 700,
      availability: "available",
      is_public: false,
      is_claimed: false,
      created_at: isoFromNow(-3),
      updated_at: isoFromNow(-3),
    },
  ]);

  // ── 11. Shot Lists ────────────────────────────────────────────────────────────
  let protettaShotListId: string | null = null;
  if (pid1) {
    const { data: sl1 } = await supabase
      .from("shot_lists")
      .insert({
        project_id: pid1,
        created_by: userId,
        title: "Day 1 — Cabin Exterior & Forest Approach",
        description: "Establishing shots and approach sequence. Golden hour priority. Have drone on standby for aerial establishing.",
        created_at: isoFromNow(-10),
        updated_at: isoFromNow(-10),
      })
      .select()
      .single();
    protettaShotListId = sl1?.id ?? null;

    if (sl1?.id) {
      await supabase.from("shot_list_items").insert([
        {
          shot_list_id: sl1.id, created_by: userId,
          shot_number: 1, scene: "EXT. CABIN - DUSK",
          location: "Big Bear Lake, CA",
          description: "Wide establishing drone shot of the cabin nestled in the pines as light fades.",
          shot_type: "wide", camera_movement: "drone",
          lens: "DJI Zenmuse X9", notes: "Golden hour. Want long shadows across the snow.",
          is_complete: false,
        },
        {
          shot_list_id: sl1.id, created_by: userId,
          shot_number: 2, scene: "EXT. CABIN - DUSK",
          location: "Big Bear Lake, CA",
          description: "Medium shot — car pulling up to the cabin through pine trees, headlights cutting through dusk.",
          shot_type: "medium", camera_movement: "dolly",
          lens: "Zeiss Supreme 50mm T1.5", notes: "Slow dolly forward. Atmosphere over speed.",
          is_complete: false,
        },
        {
          shot_list_id: sl1.id, created_by: userId,
          shot_number: 3, scene: "EXT. CABIN - DUSK",
          location: "Big Bear Lake, CA",
          description: "Close-up — protagonist's hand on the car door handle, hesitating before stepping out.",
          shot_type: "close_up", camera_movement: "static",
          lens: "Zeiss Supreme 35mm T1.5", notes: "Tight. Hold on the pause before action.",
          is_complete: false,
        },
        {
          shot_list_id: sl1.id, created_by: userId,
          shot_number: 4, scene: "EXT. CABIN PORCH - DUSK",
          location: "Big Bear Lake, CA",
          description: "Wide — couple approaches front door, sees the unlocked door ajar.",
          shot_type: "wide", camera_movement: "handheld",
          lens: "Zeiss Supreme 21mm T1.5", notes: "Slight unease in handheld. Don't over-do it.",
          is_complete: false,
        },
        {
          shot_list_id: sl1.id, created_by: userId,
          shot_number: 5, scene: "EXT. CABIN PORCH - DUSK",
          location: "Big Bear Lake, CA",
          description: "POV — pushing the door open. What's inside reveals slowly.",
          shot_type: "pov", camera_movement: "dolly",
          lens: "Zeiss Supreme 21mm T1.5", notes: "Slow push. Let tension build.",
          is_complete: false,
        },
        {
          shot_list_id: sl1.id, created_by: userId,
          shot_number: 6, scene: "INT. CABIN - CONTINUOUS",
          location: "Big Bear Lake, CA",
          description: "Cutaway — extreme close-up of half-eaten dinner plate on the table.",
          shot_type: "extreme_close_up", camera_movement: "static",
          lens: "Zeiss Supreme 85mm T1.5", notes: "Steam off the food if possible — smoke machine.",
          is_complete: false,
        },
      ]);
    }
  }

  if (pid2) {
    const { data: sl2 } = await supabase
      .from("shot_lists")
      .insert({
        project_id: pid2,
        created_by: userId,
        title: "Luminos Brand Film — Full Shot List",
        description: "90-second brand manifesto. Focus on craftsmanship, hands, and product beauty. Every shot should feel intentional.",
        created_at: isoFromNow(-5),
        updated_at: isoFromNow(-5),
      })
      .select()
      .single();

    if (sl2?.id) {
      await supabase.from("shot_list_items").insert([
        {
          shot_list_id: sl2.id, created_by: userId,
          shot_number: 1, scene: "INT. WAREHOUSE - DAY",
          location: "The Warehouse Studio, DTLA",
          description: "Opening — extreme close-up of light filaments inside a Luminos Pro bulb powering on.",
          shot_type: "extreme_close_up", camera_movement: "static",
          lens: "Zeiss Supreme 85mm T1.5", notes: "Need macro extension tubes. Slow power-on with practical light.",
          is_complete: false,
        },
        {
          shot_list_id: sl2.id, created_by: userId,
          shot_number: 2, scene: "INT. WAREHOUSE - DAY",
          location: "The Warehouse Studio, DTLA",
          description: "Wide pull-back reveal — single light illuminates a photographer's portrait setup.",
          shot_type: "wide", camera_movement: "dolly",
          lens: "Zeiss Supreme 35mm T1.5", notes: "Slow dolly out. Light blooms as it powers up.",
          is_complete: false,
        },
        {
          shot_list_id: sl2.id, created_by: userId,
          shot_number: 3, scene: "INT. WAREHOUSE - DAY",
          location: "The Warehouse Studio, DTLA",
          description: "Medium — hands adjusting the Luminos Pro head angle with precision.",
          shot_type: "medium", camera_movement: "static",
          lens: "Zeiss Supreme 50mm T1.5", notes: "Black gloves for contrast. Clean, deliberate movement.",
          is_complete: true,
        },
        {
          shot_list_id: sl2.id, created_by: userId,
          shot_number: 4, scene: "INT. WAREHOUSE - DAY",
          location: "The Warehouse Studio, DTLA",
          description: "Overhead crane shot — full studio lighting rig above a product flat lay.",
          shot_type: "overhead", camera_movement: "crane",
          lens: "Zeiss Supreme 21mm T1.5", notes: "Need full crane arm. Shoot through the grid.",
          is_complete: false,
        },
        {
          shot_list_id: sl2.id, created_by: userId,
          shot_number: 5, scene: "INT. WAREHOUSE - DAY",
          location: "The Warehouse Studio, DTLA",
          description: "Close-up — Luminos Pro logo catch light reflected in a model's eye.",
          shot_type: "extreme_close_up", camera_movement: "static",
          lens: "Zeiss Supreme 85mm T1.5", notes: "This is the hero shot. Take time to nail it.",
          is_complete: false,
        },
      ]);
    }
  }

  // ── 12. Storyboard frames for Protetta Day 1 ──────────────────────────────────
  if (pid1 && protettaShotListId) {
    await supabase.from("storyboard_frames").insert([
      {
        project_id: pid1, created_by: userId,
        frame_number: 1,
        title: "Aerial Approach",
        description: "Bird's eye view of the isolated cabin. Pine trees stretch in every direction. Smoke rises from the chimney but no car is visible.",
        shot_type: "wide",
        camera_angle: "overhead",
        mood: "Ominous, desolate",
        notes: "This sets the world. Should feel remote and beautiful but wrong somehow.",
        shot_duration: 5,
        shot_list_item_id: null,
        created_at: isoFromNow(-9),
        updated_at: isoFromNow(-9),
      },
      {
        project_id: pid1, created_by: userId,
        frame_number: 2,
        title: "Car Arrival",
        description: "Headlights cut through the trees. The car slows at the sight of the lit cabin. Driver's silhouette visible through windshield.",
        shot_type: "medium",
        camera_angle: "eye_level",
        mood: "Anticipation, unease",
        notes: "Hold on the car hesitating before it parks. That pause is everything.",
        shot_duration: 4,
        shot_list_item_id: null,
        created_at: isoFromNow(-9),
        updated_at: isoFromNow(-9),
      },
      {
        project_id: pid1, created_by: userId,
        frame_number: 3,
        title: "Hand on Handle",
        description: "Extreme close-up on the protagonist's hand gripping the car door handle. White knuckles. A beat of hesitation.",
        shot_type: "close_up",
        camera_angle: "low",
        mood: "Dread, resolve",
        notes: "Tight crop. Hold the pause 2 full seconds before they open the door.",
        shot_duration: 3,
        shot_list_item_id: null,
        created_at: isoFromNow(-9),
        updated_at: isoFromNow(-9),
      },
      {
        project_id: pid1, created_by: userId,
        frame_number: 4,
        title: "Ajar Door",
        description: "Two-shot of the couple at the porch. The front door is open a few inches. Warm interior light spills onto the porch. Nobody in sight.",
        shot_type: "medium",
        camera_angle: "eye_level",
        mood: "Dread, curiosity",
        notes: "Light quality from inside vs. cold outside is the contrast we want.",
        shot_duration: 4,
        shot_list_item_id: null,
        created_at: isoFromNow(-9),
        updated_at: isoFromNow(-9),
      },
      {
        project_id: pid1, created_by: userId,
        frame_number: 5,
        title: "Dinner Plate",
        description: "Extreme close-up of a half-eaten plate of food. Steam still rising. A wine glass tipped, red spreading across the tablecloth.",
        shot_type: "close_up",
        camera_angle: "high",
        mood: "Horror, wrongness",
        notes: "Food stylists needed. The steam is critical — smoke machine as backup.",
        shot_duration: 3,
        shot_list_item_id: null,
        created_at: isoFromNow(-9),
        updated_at: isoFromNow(-9),
      },
    ]);
  }

  // ── 13. Contracts ─────────────────────────────────────────────────────────────
  await supabase.from("contracts").insert([
    {
      created_by: userId,
      project_id: pid1,
      title: "Protetta — Crew Agreement",
      description: "Standard crew agreement covering shoot days, rate, and deliverable ownership for Protetta principal photography.",
      recipient_name: "Jordan Lee",
      recipient_email: "jordan.lee@dpwork.com",
      recipient_role: "crew",
      status: "signed",
      signing_token: crypto.randomUUID(),
      sender_name: "Alex Rivera",
      sender_signed_at: isoFromNow(-12),
      signed_at: isoFromNow(-11),
      sent_at: isoFromNow(-13),
      created_at: isoFromNow(-14),
      updated_at: isoFromNow(-11),
    },
    {
      created_by: userId,
      project_id: pid2,
      title: "Luminos — Production Services Agreement",
      description: "Full production services contract for the Luminos brand film. Includes usage rights, deliverables, and revision rounds.",
      recipient_name: "Derek Walsh",
      recipient_email: "d.walsh@helmproductions.com",
      recipient_role: "client",
      status: "sent",
      signing_token: crypto.randomUUID(),
      sender_name: "Alex Rivera",
      sender_signed_at: isoFromNow(-4),
      sent_at: isoFromNow(-4),
      created_at: isoFromNow(-5),
      updated_at: isoFromNow(-4),
    },
    {
      created_by: userId,
      project_id: pid3,
      title: "After the Rain — Wedding Film Agreement",
      description: "Wedding film agreement covering full ceremony and reception coverage, two cameras, and final film delivery within 12 weeks.",
      recipient_name: "Marcus & Claire Thorne",
      recipient_email: "claire.thorne@gmail.com",
      recipient_role: "client",
      status: "signed",
      signing_token: crypto.randomUUID(),
      sender_name: "Alex Rivera",
      sender_signed_at: isoFromNow(-62),
      signed_at: isoFromNow(-60),
      sent_at: isoFromNow(-63),
      created_at: isoFromNow(-65),
      updated_at: isoFromNow(-60),
    },
    {
      created_by: userId,
      project_id: null,
      title: "Standard Location Release",
      description: "Blanket location release form for single-day shoots at private properties. Draft template — duplicate and customize per project.",
      recipient_name: null,
      recipient_email: null,
      recipient_role: "location",
      status: "draft",
      signing_token: crypto.randomUUID(),
      sender_name: "Alex Rivera",
      created_at: isoFromNow(-20),
      updated_at: isoFromNow(-20),
    },
  ]);

  // ── 14. Forms ─────────────────────────────────────────────────────────────────
  await supabase.from("forms").insert([
    {
      created_by: userId,
      title: "New Client Production Brief",
      description: "Sent to new clients before the first creative call. Captures project goals, references, timeline, and budget range.",
      status: "active",
      token: crypto.randomUUID(),
      response_count: 3,
      questions: [
        { id: crypto.randomUUID(), section: "Project", type: "short_text", question: "What is the name of your project or brand?", required: true },
        { id: crypto.randomUUID(), section: "Project", type: "long_text", question: "Describe what you're trying to achieve with this video. What's the goal?", required: true },
        { id: crypto.randomUUID(), section: "Project", type: "single_choice", question: "What type of video are you looking for?", required: true, options: ["Brand Film", "Commercial", "Social Content", "Documentary", "Event Coverage", "Other"] },
        { id: crypto.randomUUID(), section: "Creative", type: "long_text", question: "Share 2–3 reference videos that match the look or feel you're after.", required: false },
        { id: crypto.randomUUID(), section: "Creative", type: "single_choice", question: "How would you describe the tone?", required: true, options: ["Cinematic & Premium", "Clean & Minimal", "Energetic & Fast-Paced", "Warm & Emotional", "Bold & Loud"] },
        { id: crypto.randomUUID(), section: "Logistics", type: "short_text", question: "What is your ideal delivery date?", required: true },
        { id: crypto.randomUUID(), section: "Logistics", type: "single_choice", question: "What is your approximate budget range?", required: false, options: ["Under $2,000", "$2,000–$5,000", "$5,000–$15,000", "$15,000–$40,000", "$40,000+"] },
      ],
      created_at: isoFromNow(-30),
      updated_at: isoFromNow(-30),
    },
    {
      created_by: userId,
      title: "Talent Release — On Camera",
      description: "Signed release for anyone appearing on camera. Required before footage can be used commercially.",
      status: "active",
      token: crypto.randomUUID(),
      response_count: 7,
      questions: [
        { id: crypto.randomUUID(), section: "Talent Info", type: "short_text", question: "Full legal name", required: true },
        { id: crypto.randomUUID(), section: "Talent Info", type: "short_text", question: "Email address", required: true },
        { id: crypto.randomUUID(), section: "Talent Info", type: "short_text", question: "Phone number", required: false },
        { id: crypto.randomUUID(), section: "Project", type: "short_text", question: "Project name / description of content", required: true },
        { id: crypto.randomUUID(), section: "Release", type: "single_choice", question: "Do you grant permission for your likeness to be used in the final production and any promotional materials?", required: true, options: ["Yes, I grant full permission", "Yes, but only for this project — no promotional use", "No"] },
        { id: crypto.randomUUID(), section: "Release", type: "long_text", question: "Any restrictions or special conditions?", required: false, placeholder: "e.g. face blurred in all digital ads, no use in political content, etc." },
      ],
      created_at: isoFromNow(-45),
      updated_at: isoFromNow(-10),
    },
    {
      created_by: userId,
      title: "Post-Delivery Client Feedback",
      description: "Short feedback form sent after final delivery. Helps gather testimonials and referrals.",
      status: "active",
      token: crypto.randomUUID(),
      response_count: 2,
      questions: [
        { id: crypto.randomUUID(), section: "Experience", type: "single_choice", question: "Overall, how satisfied are you with the final film?", required: true, options: ["Exceeded expectations", "Met expectations", "Mostly satisfied", "Needs improvement"] },
        { id: crypto.randomUUID(), section: "Experience", type: "single_choice", question: "How was communication throughout the project?", required: true, options: ["Excellent", "Good", "Average", "Poor"] },
        { id: crypto.randomUUID(), section: "Experience", type: "long_text", question: "What did you love most about working with us?", required: false },
        { id: crypto.randomUUID(), section: "Experience", type: "long_text", question: "Is there anything we could have done better?", required: false },
        { id: crypto.randomUUID(), section: "Referral", type: "single_choice", question: "Would you recommend us to other businesses or colleagues?", required: true, options: ["Definitely", "Probably", "Not sure", "No"] },
        { id: crypto.randomUUID(), section: "Referral", type: "long_text", question: "We'd love to feature your project — may we use a short testimonial quote from you?", required: false, placeholder: "Feel free to write something or leave blank" },
      ],
      created_at: isoFromNow(-15),
      updated_at: isoFromNow(-5),
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
