import { createClient } from "@supabase/supabase-js";
import { AnalyticsCharts } from "./AnalyticsCharts";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function AnalyticsPage() {
  const supabase = getAdmin();

  const [
    { data: { users: authUsers } },
    { data: profiles },
    { data: projects },
    { data: invoices },
    { data: contracts },
    { data: forms },
    { data: demos },
  ] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("profiles").select("id, plan, created_at"),
    supabase.from("projects").select("created_by, created_at"),
    supabase.from("invoices").select("created_by, status, amount, created_at"),
    supabase.from("contracts").select("created_by, status, created_at"),
    supabase.from("forms").select("created_by, response_count, created_at"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const realUsers = (authUsers ?? []).filter((u) => !u.email?.endsWith("@demo.usecineflow.com"));
  const demoUsers = (authUsers ?? []).filter((u) => u.email?.endsWith("@demo.usecineflow.com"));

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

  // Plan breakdown
  const planCounts: Record<string, number> = {};
  for (const p of profiles ?? []) {
    const plan = p.plan ?? "unknown";
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }
  const planChart = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }));

  // Feature usage — unique users who have used each feature
  const usedProjects = new Set((projects ?? []).map((p) => p.created_by)).size;
  const usedInvoices = new Set((invoices ?? []).map((i) => i.created_by)).size;
  const usedContracts = new Set((contracts ?? []).map((c) => c.created_by)).size;
  const usedForms = new Set((forms ?? []).map((f) => f.created_by)).size;

  const featureUsage = [
    { feature: "Projects", users: usedProjects },
    { feature: "Invoices", users: usedInvoices },
    { feature: "Contracts", users: usedContracts },
    { feature: "Forms", users: usedForms },
  ];

  const totalInvoiceValue = (invoices ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.amount ?? 0), 0);

  const stats = [
    { label: "Total real users", value: realUsers.length },
    { label: "Active (7 days)", value: active7 },
    { label: "Active (30 days)", value: active30 },
    { label: "Demo sessions today", value: demoUsers.filter((u) => u.created_at > new Date(now - 86400000).toISOString()).length },
    { label: "Total projects", value: (projects ?? []).length },
    { label: "Total invoices sent", value: (invoices ?? []).filter((i) => i.status !== "draft").length },
    { label: "Invoice value paid", value: `$${totalInvoiceValue.toLocaleString()}` },
    { label: "Contracts signed", value: (contracts ?? []).filter((c) => c.status === "signed").length },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Platform-wide usage and growth</p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-4 gap-4">
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
      />
    </div>
  );
}
