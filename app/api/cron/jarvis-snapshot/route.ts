import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdmin();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: { users: allUsers } }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, plan, plan_status, trial_ends_at, is_test"),
  ]);

  const testIds = new Set((profiles ?? []).filter((p: any) => p.is_test).map((p: any) => p.id));
  const real = (allUsers ?? []).filter(
    (u: any) => !u.email?.endsWith("@demo.usecineflow.com") && !testIds.has(u.id)
  );
  const realIds = new Set(real.map((u: any) => u.id));
  const rp = (profiles ?? []).filter((p: any) => realIds.has(p.id));

  const planMRR: Record<string, number> = { solo: 39, studio: 79, agency: 159, enterprise: 299 };
  const mrr = rp
    .filter((p: any) => (p.plan_status === "active" || p.plan_status === "founding") && p.plan !== "lifetime")
    .reduce((s: number, p: any) => s + (planMRR[p.plan] ?? 0), 0);

  const breakdown = rp.reduce((acc: Record<string, number>, p: any) => {
    if (p.plan) acc[p.plan] = (acc[p.plan] || 0) + 1;
    return acc;
  }, {});

  const snapshot = {
    total: real.length,
    signupsToday: real.filter((u: any) => new Date(u.created_at) >= today).length,
    signupsWeek:  real.filter((u: any) => u.created_at >= weekAgo).length,
    activeLastWeek: real.filter((u: any) => u.last_sign_in_at && u.last_sign_in_at >= weekAgo).length,
    paid:     rp.filter((p: any) => p.plan_status === "active" || p.plan_status === "founding" || p.plan === "lifetime").length,
    trialing: rp.filter((p: any) => p.plan_status === "trialing" && new Date(p.trial_ends_at) > new Date()).length,
    expired:  rp.filter((p: any) => p.plan_status === "trialing" && new Date(p.trial_ends_at) <= new Date()).length,
    mrr, arr: mrr * 12, breakdown,
  };

  const dateStr = today.toISOString().slice(0, 10);
  const { error } = await admin
    .from("jarvis_metrics_snapshots")
    .upsert({ snapshot_date: dateStr, data: snapshot }, { onConflict: "snapshot_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true, date: dateStr, snapshot });
}
