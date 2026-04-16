import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Look up portal by token
  const { data: portal, error: portalError } = await supabaseAdmin
    .from("client_portals")
    .select("id, created_by, client_name, is_active")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (portalError || !portal) {
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
