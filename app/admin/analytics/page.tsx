import { createClient } from "@supabase/supabase-js";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { requireAdminPage } from "@/lib/admin-guard";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function AnalyticsPage() {
  await requireAdminPage();
  const supabase = getAdmin();

  const [
    { data: { users: authUsers } },
    { data: profiles },
    { data: projects },
    { data: invoices },
    { data: contracts },
    { data: forms },
    { data: utmProfiles },
  ] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("profiles").select("id, plan, plan_status, trial_ends_at, created_at, is_test"),
    supabase.from("projects").select("created_by, created_at"),
    supabase.from("invoices").select("created_by, status, amount, created_at"),
    supabase.from("contracts").select("created_by, status, created_at"),
    supabase.from("forms").select("created_by, response_count, created_at"),
    supabase.from("profiles").select("utm_source, utm_medium, utm_campaign").not("utm_source", "is", null),
  ]);

  const testUserIds = new Set((profiles ?? []).filter((p) => p.is_test).map((p) => p.id));
  const realUsers = (authUsers ?? []).filter(
    (u) => !u.email?.endsWith("@demo.usecineflow.com") && !testUserIds.has(u.id)
  );
  const demoUsers = (authUsers ?? []).filter((u) => u.email?.endsWith("@demo.usecineflow.com"));
  const realUserIds = new Set(realUsers.map((u) => u.id));

  // Signups per day — last 30 days
  const now = Date.now();
  const days30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const signupsByDay = Object.fromEntries(days30.map((d) => [d, 0]));
  for (const u of realUsers) {
    const day = u.created_at.slice(0, 10);
    if (day in signupsByDay) signupsByDay[day]++;
  }
  const signupChart = days30.map((day) => ({
    date: day.slice(5), // MM-DD
    signups: signupsByDay[day],
  }));

  // Active users (last sign in within 7 days)
  const cutoff7 = new Date(now - 7 * 86400000).toISOString();
  const cutoff30 = new Date(now - 30 * 86400000).toISOString();
  const active7 = realUsers.filter((u) => u.last_sign_in_at && u.last_sign_in_at > cutoff7).length;
  const active30 = realUsers.filter((u) => u.last_sign_in_at && u.last_sign_in_at > cutoff30).length;

  // Plan breakdown — real users only
  const planCounts: Record<string, number> = {};
  for (const p of (profiles ?? []).filter((p) => realUserIds.has(p.id))) {
    const plan = p.plan ?? "unknown";
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }
  const planChart = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }));

  // Feature usage — real users only
  const usedProjects = new Set((projects ?? []).filter((p) => realUserIds.has(p.created_by)).map((p) => p.created_by)).size;
  const usedInvoices = new Set((invoices ?? []).filter((i) => realUserIds.has(i.created_by)).map((i) => i.created_by)).size;
  const usedContracts = new Set((contracts ?? []).filter((c) => realUserIds.has(c.created_by)).map((c) => c.created_by)).size;
  const usedForms = new Set((forms ?? []).filter((f) => realUserIds.has(f.created_by)).map((f) => f.created_by)).size;

  const featureUsage = [
    { feature: "Projects", users: usedProjects },
    { feature: "Invoices", users: usedInvoices },
    { feature: "Contracts", users: usedContracts },
    { feature: "Forms", users: usedForms },
  ];

  const totalInvoiceValue = (invoices ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.amount ?? 0), 0);

  // Trial health — real users only
  const realProfiles = (profiles ?? []).filter((p) => realUserIds.has(p.id));
  const now7days = new Date(now + 7 * 86400000).toISOString();
  const trialsActive   = realProfiles.filter((p) => p.plan_status === "trialing" && p.trial_ends_at && new Date(p.trial_ends_at) > new Date()).length;
  const trialsExpiring = realProfiles.filter((p) => p.plan_status === "trialing" && p.trial_ends_at && new Date(p.trial_ends_at) > new Date() && p.trial_ends_at < now7days).length;
  const trialsExpired  = realProfiles.filter((p) => p.plan_status === "trialing" && (!p.trial_ends_at || new Date(p.trial_ends_at) <= new Date())).length;
  const paidUsers      = realProfiles.filter((p) => p.plan_status === "active" || p.plan === "lifetime" || p.plan_status === "founding").length;

  // Trial → paid conversion rate
  const totalTrialers = paidUsers + trialsActive + trialsExpired;
  const conversionRate = totalTrialers > 0 ? ((paidUsers / totalTrialers) * 100).toFixed(1) : "0.0";

  // Activation rate: users created in last 30 days who created at least 1 project
  const cutoff30iso = new Date(now - 30 * 86400000).toISOString();
  const recentUserIds = new Set(realUsers.filter((u) => u.created_at > cutoff30iso).map((u) => u.id));
  const activatedUserIds = new Set((projects ?? []).map((p) => p.created_by).filter((id) => recentUserIds.has(id)));
  const activationRate = recentUserIds.size > 0 ? ((activatedUserIds.size / recentUserIds.size) * 100).toFixed(1) : "0.0";

  // Signups per month — last 6 months
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7); // YYYY-MM
  });
  const signupsByMonth = Object.fromEntries(months6.map((m) => [m, 0]));
  for (const u of realUsers) {
    const month = u.created_at.slice(0, 7);
    if (month in signupsByMonth) signupsByMonth[month]++;
  }
  const monthlySignupChart = months6.map((m) => ({
    month: new Date(m + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    signups: signupsByMonth[m],
  }));

  const stats = [
    { label: "Total real users", value: realUsers.length },
    { label: "Active (7 days)", value: active7 },
    { label: "Active (30 days)", value: active30 },
    { label: "Paid / Founding / Lifetime", value: paidUsers },
    { label: "Trial → paid conversion", value: `${conversionRate}%` },
    { label: "Activation rate (30d)", value: `${activationRate}%` },
    { label: "Trials active", value: trialsActive },
    { label: "Trials expiring (7 days)", value: trialsExpiring },
    { label: "Trials expired (no conversion)", value: trialsExpired },
    { label: "Demo sessions today", value: demoUsers.filter((u) => u.created_at > new Date(new Date(now).setHours(0, 0, 0, 0)).toISOString()).length },
    { label: "Total projects", value: (projects ?? []).length },
    { label: "Total invoices sent", value: (invoices ?? []).filter((i) => i.status !== "draft").length },
    { label: "Invoice value paid", value: `$${totalInvoiceValue.toLocaleString()}` },
    { label: "Contracts signed", value: (contracts ?? []).filter((c) => c.status === "signed").length },
  ];

  // UTM source breakdown
  const utmSources: Record<string, number> = {};
  for (const p of utmProfiles ?? []) {
    const src = p.utm_source ?? "unknown";
    utmSources[src] = (utmSources[src] ?? 0) + 1;
  }
  const utmRows = Object.entries(utmSources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Platform-wide usage and growth</p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <AnalyticsCharts
        signupChart={signupChart}
        planChart={planChart}
        featureUsage={featureUsage}
        monthlySignupChart={monthlySignupChart}
      />

      {/* UTM attribution */}
      {utmRows.length > 0 && (
        <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">Traffic sources (UTM)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                <th className="pb-2 text-xs font-medium text-zinc-500">Source</th>
                <th className="pb-2 text-right text-xs font-medium text-zinc-500">Signups</th>
                <th className="pb-2 text-right text-xs font-medium text-zinc-500">Share</th>
              </tr>
            </thead>
            <tbody>
              {utmRows.map(([src, count]) => {
                const total = (utmProfiles ?? []).length;
                return (
                  <tr key={src} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2 font-mono text-xs text-zinc-300">{src}</td>
                    <td className="py-2 text-right text-zinc-400">{count}</td>
                    <td className="py-2 text-right text-zinc-500">
                      {total > 0 ? `${((count / total) * 100).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-zinc-600">
            {(utmProfiles ?? []).length} of {realUsers.length} users have UTM data captured.
          </p>
        </div>
      )}
    </div>
  );
}
