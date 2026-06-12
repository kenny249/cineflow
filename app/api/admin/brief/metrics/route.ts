import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminPage } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    await requireAdminPage();
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
    console.error("[brief/metrics]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
