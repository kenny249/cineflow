import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function ReferralsPage() {
  const supabase = getAdmin();

  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, referral_code, referred_by, plan");

  const realUsers = (authUsers ?? []).filter((u) => !u.email?.endsWith("@demo.usecineflow.com"));
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // Count how many signups each referral code has generated
  const referralCounts: Record<string, { code: string; owner: string; ownerId: string; signups: number; converted: number }> = {};

  for (const u of realUsers) {
    const p = profileMap[u.id];
    if (!p?.referral_code) continue;
    referralCounts[p.referral_code] = {
      code: p.referral_code,
      owner: [p.first_name, p.last_name].filter(Boolean).join(" ") || u.email ?? "—",
      ownerId: u.id,
      signups: 0,
      converted: 0,
    };
  }

  // Count referrals
  for (const u of realUsers) {
    const p = profileMap[u.id];
    if (!p?.referred_by || !referralCounts[p.referred_by]) continue;
    referralCounts[p.referred_by].signups++;
    // "Converted" means on a paid plan (not beta/unknown)
    if (["solo", "studio", "agency", "lifetime"].includes(p.plan ?? "")) {
      referralCounts[p.referred_by].converted++;
    }
  }

  const rows = Object.values(referralCounts).sort((a, b) => b.signups - a.signups);
  const totalReferrals = rows.reduce((s, r) => s + r.signups, 0);

  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Referrals</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Track who's referring new users to Cineflow</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Users with referral codes", value: rows.length },
          { label: "Total referral signups", value: totalReferrals },
          { label: "Link format", value: `${appUrl}/?ref=CODE` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-sm font-bold text-white truncate">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-600">
            No referral codes generated yet. They&apos;re created automatically when users sign up.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["User", "Referral code", "Link", "Signups", "Converted"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-zinc-300 font-medium">{r.owner}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-300 font-mono">{r.code}</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 font-mono">?ref={r.code}</td>
                  <td className="px-4 py-3 text-white font-semibold">{r.signups}</td>
                  <td className="px-4 py-3 text-emerald-400 font-semibold">{r.converted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
