import { createClient } from "@supabase/supabase-js";
import { Activity, Users, Clock, Trash2 } from "lucide-react";
import { SystemDemoActions } from "./SystemDemoActions";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function SystemPage() {
  const supabase = getAdmin();

  const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  const demoUsers = (allUsers ?? [])
    .filter((u) => u.email?.endsWith("@demo.usecineflow.com"))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Demo age buckets
  const now = Date.now();
  const expired = demoUsers.filter((u) => now - new Date(u.created_at).getTime() > 7 * 86400000);
  const active = demoUsers.filter((u) => now - new Date(u.created_at).getTime() <= 7 * 86400000);

  const crons = [
    { name: "Invoice reminders", schedule: "Daily at 9 AM UTC", path: "/api/cron/invoice-reminders" },
    { name: "Calendar reminders", schedule: "Daily at 6 PM UTC", path: "/api/cron/calendar-reminders" },
    { name: "Demo cleanup", schedule: "Daily at 3 AM UTC", path: "/api/cron/cleanup-demo" },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">System</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Demo accounts, cron jobs, and platform health</p>
      </div>

      {/* Demo stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Total demo accounts", value: demoUsers.length, icon: Users },
          { label: "Active (< 7 days)", value: active.length, icon: Activity },
          { label: "Expired (> 7 days)", value: expired.length, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-zinc-600" />
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {expired.length > 0 && (
        <SystemDemoActions expiredCount={expired.length} />
      )}

      {/* Cron jobs */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Scheduled jobs</h2>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Job", "Schedule", "Endpoint"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {crons.map((c) => (
                <tr key={c.name} className="border-b border-white/[0.03]">
                  <td className="px-4 py-3 text-zinc-300 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{c.schedule}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">{c.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent demo accounts */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Recent demo sessions ({demoUsers.length})</h2>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Email", "Created", "Age", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demoUsers.slice(0, 20).map((u) => {
                const ageMs = now - new Date(u.created_at).getTime();
                const ageDays = Math.floor(ageMs / 86400000);
                const isExpired = ageDays > 7;
                return (
                  <tr key={u.id} className="border-b border-white/[0.03]">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{ageDays === 0 ? "Today" : `${ageDays}d`}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isExpired ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                        {isExpired ? "Expired" : "Active"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {demoUsers.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-zinc-600">No demo accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
