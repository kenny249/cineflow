import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(request);
  if (isRateLimited(`client-portal:${ip}`, 30, 60_000)) {
    console.warn("[client/portal] rate limited ip:", ip);
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  const supabaseAdmin = getAdmin();

  // Look up portal by token
  const { data: portal, error: portalError } = await supabaseAdmin
    .from("client_portals")
    .select("id, created_by, client_name, is_active")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (portalError || !portal) {
    console.warn("[client/portal] not found, token:", token.slice(0, 8));
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Get all active projects for this client
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, title, type, status")
    .eq("created_by", portal.created_by)
    .eq("client_name", portal.client_name)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p: { id: string }) => p.id);

  // Get all delivered video deliverables for those projects
  let deliverables: unknown[] = [];
  if (projectIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("video_deliverables")
      .select("id, project_id, title, type, url, notes, delivered_at, created_at")
      .in("project_id", projectIds)
      .eq("status", "delivered")
      .order("delivered_at", { ascending: false });
    deliverables = data ?? [];
  }

  return NextResponse.json({
    client_name: portal.client_name,
    projects: projects ?? [],
    deliverables,
  });
}
