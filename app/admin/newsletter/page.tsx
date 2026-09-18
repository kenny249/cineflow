import { createClient } from "@supabase/supabase-js";
import { Mail } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-guard";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function NewsletterPage() {
  await requireAdminPage();
  const supabase = getAdmin();

  const { data: subscribers, count } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, source, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Newsletter</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {count ?? 0} email{count === 1 ? "" : "s"} captured from the landing page
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
        <Mail className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
        <p className="text-xs leading-relaxed text-amber-200/80">
          These are visitors who left an email for occasional updates — not signups. No account, no profile,
          no trial exists for them. They live only in this table (<code className="text-amber-300/90">newsletter_subscribers</code>),
          separate from <code className="text-amber-300/90">profiles</code>/<code className="text-amber-300/90">auth.users</code>.
          Sending updates is a manual, occasional thing (roughly monthly) — nothing here is automated.
        </p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-white/[0.02] text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Captured</th>
            </tr>
          </thead>
          <tbody>
            {(subscribers ?? []).map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-zinc-300">{s.email}</td>
                <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{s.source}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {new Date(s.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </td>
              </tr>
            ))}
            {(!subscribers || subscribers.length === 0) && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-600">
                  No newsletter signups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
