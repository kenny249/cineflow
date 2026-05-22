import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { UsersTable } from "./UsersTable";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export default async function UsersPage() {
  const supabase = getAdmin();
  const currentUserId = await getCurrentUserId();

  // Fetch all auth users
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, company, business_name, plan, is_admin, is_lifetime, referral_code, referred_by, created_at");

  // Fetch invoice counts per user
  const { data: invoiceCounts } = await supabase
    .from("invoices")
    .select("created_by")
    .neq("status", "draft");

  // Fetch project counts per user
  const { data: projectCounts } = await supabase
    .from("projects")
    .select("created_by");

  const invoiceMap: Record<string, number> = {};
  for (const inv of invoiceCounts ?? []) {
    invoiceMap[inv.created_by] = (invoiceMap[inv.created_by] ?? 0) + 1;
  }

  const projectMap: Record<string, number> = {};
  for (const proj of projectCounts ?? []) {
    projectMap[proj.created_by] = (projectMap[proj.created_by] ?? 0) + 1;
  }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const users = (authUsers ?? [])
    .filter((u) => !u.email?.endsWith("@demo.usecineflow.com"))
    .map((u) => {
      const p = profileMap[u.id] ?? {};
      return {
        id: u.id,
        email: u.email ?? "",
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
        company: p.business_name || p.company || null,
        plan: p.plan ?? "—",
        is_admin: p.is_admin ?? false,
        referral_code: p.referral_code ?? null,
        referred_by: p.referred_by ?? null,
        invoices: invoiceMap[u.id] ?? 0,
        projects: projectMap[u.id] ?? 0,
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalUsers = users.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newToday = users.filter((u) => new Date(u.created_at) >= today).length;
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const newThisMonth = users.filter((u) => new Date(u.created_at) >= thisMonth).length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Users</h1>
        <p className="text-sm text-zinc-500 mt-0.5">All real accounts (demo accounts excluded)</p>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Total users", value: totalUsers },
          { label: "New today", value: newToday },
          { label: "New this month", value: newThisMonth },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <UsersTable users={users} currentUserId={currentUserId ?? ""} />
    </div>
  );
}
