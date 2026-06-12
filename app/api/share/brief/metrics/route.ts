import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Public endpoint — returns only aggregate counts, zero PII.
// Gated by the referer token being in the URL (enforced by the page route).
// Additionally rate-limited by Vercel edge.
export async function GET(req: NextRequest) {
  try {
    // Verify the request is coming from a valid share URL
    const referer = req.headers.get("referer") ?? "";
    const token = process.env.BRIEF_SHARE_TOKEN;
    if (!token || !referer.includes(token)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getAdmin();
    const [authUsersRes, profilesRes, projectsRes] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("profiles").select("plan_status, trial_ends_at"),
      supabase.from("projects").select("id", { count: "exact", head: true }),
    ]);

    const authUsers = authUsersRes.data?.users ?? [];
    const realUsers = authUsers.filter((u) => !u.email?.endsWith("@demo.usecineflow.com"));
    const profiles = profilesRes.data ?? [];
    const now = new Date().toISOString();
    const activeTrials = profiles.filter(
      (p) => p.plan_status === "trialing" && p.trial_ends_at && p.trial_ends_at > now
    ).length;

    return NextResponse.json({
      totalUsers: realUsers.length,
      activeTrials,
      totalProjects: projectsRes.count ?? 0,
    });
  } catch (err: any) {
    console.error("[share/brief/metrics]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
