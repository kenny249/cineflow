import { createClient } from "@supabase/supabase-js";
import { requireAdminPage } from "@/lib/admin-guard";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const ACTION_LABELS: Record<string, string> = {
  update_user:    "Updated user",
  delete_user:    "Deleted user",
  email_user:     "Emailed user",
  impersonate_user: "Logged in as user",
  add_note:       "Added note",
  delete_note:    "Deleted note",
};

function actionColor(action: string): string {
  if (action === "delete_user") return "text-red-400";
  if (action === "impersonate_user") return "text-amber-400";
  if (action === "email_user") return "text-blue-400";
  return "text-zinc-300";
}

export default async function AuditLogPage() {
  await requireAdminPage();
  const supabase = getAdmin();

  const { data: logs } = await supabase
    .from("admin_audit_log")
    .select("id, actor_id, action, target_id, target_type, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // Fetch actor names
  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id))];
  const actorNames: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      actorNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Admin";
    }
  }

  // Fetch target user emails
  const targetIds = [...new Set((logs ?? []).filter((l) => l.target_type === "user" && l.target_id).map((l) => l.target_id!))];
  const targetEmails: Record<string, string> = {};
  if (targetIds.length > 0) {
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of users ?? []) {
      if (targetIds.includes(u.id)) targetEmails[u.id] = u.email ?? u.id;
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-zinc-500 mt-0.5">All admin actions — last 200 entries</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["When", "Admin", "Action", "Target", "Details"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-600">
                  No actions logged yet.
                </td>
              </tr>
            ) : (logs ?? []).map((log) => (
              <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {actorNames[log.actor_id] ?? log.actor_id.slice(0, 8)}
                </td>
                <td className={`px-4 py-3 text-xs font-medium ${actionColor(log.action)}`}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {log.target_id ? (targetEmails[log.target_id] ?? log.target_id.slice(0, 8)) : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-600 font-mono">
                  {log.metadata ? JSON.stringify(log.metadata) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
