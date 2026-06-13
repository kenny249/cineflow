import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const type = req.nextUrl.searchParams.get("type");

  if (!token || !type) {
    return NextResponse.json({ business_name: null, logo_url: null, brand_color: null });
  }

  const db = admin();
  let userId: string | null = null;

  try {
    if (type === "board") {
      const { data } = await db
        .from("boards")
        .select("workspace_id")
        .eq("share_token", token)
        .maybeSingle();
      userId = data?.workspace_id ?? null;
    } else if (type === "review") {
      const { data: tokenRow } = await db
        .from("review_tokens")
        .select("project_id")
        .eq("token", token)
        .eq("is_active", true)
        .maybeSingle();
      if (tokenRow?.project_id) {
        const { data: project } = await db
          .from("projects")
          .select("created_by")
          .eq("id", tokenRow.project_id)
          .maybeSingle();
        userId = project?.created_by ?? null;
      }
    } else if (type === "client") {
      const { data } = await db
        .from("client_portals")
        .select("created_by")
        .eq("token", token)
        .eq("is_active", true)
        .maybeSingle();
      userId = data?.created_by ?? null;
    }
  } catch { /* swallow — return nulls */ }

  if (!userId) {
    return NextResponse.json({ business_name: null, logo_url: null, brand_color: null });
  }

  const { data: profile } = await db
    .from("profiles")
    .select("business_name, logo_url, brand_color")
    .eq("id", userId)
    .maybeSingle();

  return NextResponse.json({
    business_name: profile?.business_name ?? null,
    logo_url: profile?.logo_url ?? null,
    brand_color: profile?.brand_color ?? null,
  });
}
