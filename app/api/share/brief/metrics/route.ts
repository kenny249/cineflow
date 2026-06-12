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

// Public endpoint — aggregate counts only, zero PII.
// Gated by ?t=token matching BRIEF_SHARE_TOKEN env var.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provided = searchParams.get("t") ?? "";
    const validToken = process.env.BRIEF_SHARE_TOKEN;
    if (!validToken || provided !== validToken) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getAdmin();
    const [authUsersRes, profilesRes, projectsRes] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("profiles").select("id, plan_status, trial_ends_at, is_test"),
      supabase.from("projects").select("id, created_by"),
    ]);

    const authUsers = authUsersRes.data?.users ?? [];
    const profiles = profilesRes.data ?? [];
    const projects = projectsRes.data ?? [];

    const testUserIds = new Set(profiles.filter((p) => p.is_test).map((p) => p.id));
    const realUsers = authUsers.filter(
      (u) => !u.email?.endsWith("@demo.usecineflow.com") && !testUserIds.has(u.id)
    );

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const activeRecently = realUsers.filter(
      (u) => u.last_sign_in_at && u.last_sign_in_at > thirtyDaysAgo
    ).length;

    const now = new Date().toISOString();
    const realProfileIds = new Set(realUsers.map((u) => u.id));
    const activeTrials = profiles.filter(
      (p) =>
        realProfileIds.has(p.id) &&
        p.plan_status === "trialing" &&
        p.trial_ends_at &&
        p.trial_ends_at > now
    ).length;

    const realProjects = projects.filter((p) => !testUserIds.has(p.created_by)).length;

    return NextResponse.json({
      totalUsers: realUsers.length,
      activeTrials,
      activeRecently,
      totalProjects: realProjects,
    });
  } catch (err: any) {
    console.error("[share/brief/metrics]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
