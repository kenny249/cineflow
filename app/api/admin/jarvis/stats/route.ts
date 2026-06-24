import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getAdmin();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function GET() {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdmin();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: { users: allUsers } }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, plan, plan_status, trial_ends_at, is_test"),
  ]);

  const testIds = new Set((profiles ?? []).filter((p: any) => p.is_test).map((p: any) => p.id));
  const realUsers = (allUsers ?? []).filter(
    (u: any) => !u.email?.endsWith("@demo.usecineflow.com") && !testIds.has(u.id)
  );

  const realIds = new Set(realUsers.map((u: any) => u.id));
  const realProfiles = (profiles ?? []).filter((p: any) => realIds.has(p.id));

  const paid = realProfiles.filter((p: any) =>
    p.plan_status === "active" || p.plan_status === "founding" || p.plan === "lifetime"
  ).length;

  const planMRR: Record<string, number> = { solo: 39, studio: 79, agency: 159, enterprise: 299 };
  const mrr = realProfiles
    .filter((p: any) => (p.plan_status === "active" || p.plan_status === "founding") && p.plan !== "lifetime")
    .reduce((sum: number, p: any) => sum + (planMRR[p.plan] ?? 0), 0);

  return NextResponse.json({
    totalUsers: realUsers.length,
    signupsToday: realUsers.filter((u: any) => new Date(u.created_at) >= today).length,
    activeLastWeek: realUsers.filter((u: any) => u.last_sign_in_at && u.last_sign_in_at >= weekAgo).length,
    paid,
    mrr,
  });
}
