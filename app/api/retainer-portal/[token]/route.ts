import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/retainer-portal/[token] — public endpoint, no auth required
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const supabase = getAdmin();

  // Fetch retainer by portal token
  const { data: retainer, error: retainerErr } = await supabase
    .from("retainers")
    .select("id, client_name, monthly_rate, template, is_active, start_date, created_by")
    .eq("portal_token", token)
    .single();

  if (retainerErr || !retainer) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Fetch agency display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, company, full_name")
    .eq("id", retainer.created_by)
    .single();

  const agencyName =
    profile?.business_name || profile?.company || profile?.full_name || "Studio";

  // Fetch all months, ordered newest first
  const { data: months } = await supabase
    .from("retainer_months")
    .select("*")
    .eq("retainer_id", retainer.id)
    .order("month_year", { ascending: false });

  const allMonths = months ?? [];

  // Pick the most relevant month to show:
  // 1. First active/planning month (newest), or
  // 2. Most recently wrapped/invoiced month
  const activeMonth =
    allMonths.find((m) => m.status === "active" || m.status === "planning") ??
    allMonths[0] ??
    null;

  // Fetch deliverables for active month
  let deliverables: unknown[] = [];
  if (activeMonth) {
    const { data: dels } = await supabase
      .from("retainer_deliverables")
      .select("id, title, type, status, sort_order")
      .eq("month_id", activeMonth.id)
      .order("sort_order", { ascending: true });
    deliverables = dels ?? [];
  }

  return NextResponse.json({
    retainer: {
      client_name: retainer.client_name,
      monthly_rate: retainer.monthly_rate,
      template: retainer.template,
      is_active: retainer.is_active,
    },
    agencyName,
    activeMonth,
    deliverables,
    allMonths: allMonths.map((m) => ({
      id: m.id,
      month_year: m.month_year,
      status: m.status,
    })),
  });
}

// POST /api/retainer-portal/[token] — generate a portal token (authenticated agency only)
// Note: token param is the retainer ID here, not a portal token
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: retainerId } = await params;

  // This endpoint requires auth — use the user's session via the Authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessToken = authHeader.slice(7);

  const supabase = getAdmin();

  // Verify the user owns this retainer
  const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: retainer, error: retainerErr } = await supabase
    .from("retainers")
    .select("id, portal_token, created_by")
    .eq("id", retainerId)
    .eq("created_by", user.id)
    .single();

  if (retainerErr || !retainer) {
    return NextResponse.json({ error: "Retainer not found" }, { status: 404 });
  }

  // Return existing token if already generated
  if (retainer.portal_token) {
    return NextResponse.json({ portal_token: retainer.portal_token });
  }

  // Generate and save new token
  const portalToken = crypto.randomUUID();
  const { error: updateErr } = await supabase
    .from("retainers")
    .update({ portal_token: portalToken, updated_at: new Date().toISOString() })
    .eq("id", retainerId);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to generate link" }, { status: 500 });
  }

  return NextResponse.json({ portal_token: portalToken });
}
