import { createClient } from "@supabase/supabase-js";
import { requireAdminPage } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function ReferralsPage() {
  await requireAdminPage();
  const supabase = getAdmin();

  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, referral_code, referred_by, plan");

  const realUsers = (authUsers ?? []).filter((u) => !u.email?.endsWith("@demo.usecineflow.com"));
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const emailMap = Object.fromEntries(realUsers.map((u) => [u.id, u.email ?? ""]));

  type ReferralRow = {
    code: string;
    owner: string;
    ownerEmail: string;
    signups: number;
    converted: number;
    referredUsers: { name: string; email: string; plan: string; joinedAt: string }[];
  };

  const referralMap: Record<string, ReferralRow> = {};

  for (const u of realUsers) {
    const p = profileMap[u.id];
    if (!p?.referral_code) continue;
    referralMap[p.referral_code] = {
      code: p.referral_code,
      owner: [p.first_name, p.last_name].filter(Boolean).join(" ") || "—",
      ownerEmail: u.email || "—",
      signups: 0,
      converted: 0,
      referredUsers: [],
    };
  }

  for (const u of realUsers) {
    const p = profileMap[u.id];
    if (!p?.referred_by || !referralMap[p.referred_by]) continue;
    const row = referralMap[p.referred_by];
    row.signups++;
    if (["solo", "studio", "agency", "enterprise", "lifetime"].includes(p.plan ?? "")) row.converted++;
    row.referredUsers.push({
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "—",
      email: emailMap[u.id] || "—",
      plan: p.plan || "studio_beta",
      joinedAt: new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    });
  }

  const rows = Object.values(referralMap).sort((a, b) => b.signups - a.signups);
  const totalReferrals = rows.reduce((s, r) => s + r.signups, 0);
  const totalConverted = rows.reduce((s, r) => s + r.converted, 0);
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Referrals</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Track who&apos;s referring new users to Cineflow</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          { label: "Users with referral codes", value: rows.length },
          { label: "Total referral signups", value: totalReferrals },
          { label: "Converted to paid", value: totalConverted },
          { label: "Link format", value: `${appUrl}/?ref=CODE` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-sm font-bold text-white truncate">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center text-sm text-zinc-600">
            No referral codes generated yet. They&apos;re created automatically when users sign up.
          </div>
        ) : rows.map((r) => (
          <div key={r.code} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {/* Referrer row */}
            <div className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.04]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/10 border border-[#d4a853]/20">
                <span className="text-xs font-bold text-[#d4a853]">{(r.owner !== "—" ? r.owner : r.ownerEmail).charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{r.owner}</p>
                <p className="text-xs text-zinc-500 truncate">{r.ownerEmail}</p>
              </div>
              <code className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-300 font-mono">{r.code}</code>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-white">{r.signups}</p>
                <p className="text-[10px] text-zinc-600">signups</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-400">{r.converted}</p>
                <p className="text-[10px] text-zinc-600">converted</p>
              </div>
            </div>

            {/* Referred users */}
            {r.referredUsers.length > 0 && (
              <div className="divide-y divide-white/[0.03]">
                {r.referredUsers.map((u) => (
                  <div key={u.email} className="flex items-center gap-3 px-4 py-2.5 pl-14">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-zinc-400">{u.name !== "—" ? u.name : u.email}</span>
                      {u.name !== "—" && <span className="ml-2 text-xs text-zinc-600">{u.email}</span>}
                    </div>
                    <span className="text-[10px] text-zinc-600">{u.joinedAt}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      u.plan === "lifetime" ? "bg-[#d4a853]/15 text-[#d4a853] border-[#d4a853]/30" :
                      u.plan.includes("studio") ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      u.plan.includes("solo") ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                      "bg-zinc-800 text-zinc-500 border-zinc-700"
                    }`}>{u.plan}</span>
                  </div>
                ))}
              </div>
            )}

            {r.signups === 0 && (
              <p className="px-4 py-2.5 pl-14 text-xs text-zinc-600">No signups yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
