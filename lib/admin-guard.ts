import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type AdminRole = "super_admin" | "support" | "finance" | null;

export async function requireAdminPage(): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");
}

// Returns the calling admin's role for granular permission checks in API routes.
// Returns null if not an admin.
export async function getAdminRole(): Promise<AdminRole | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin, admin_role")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return null;
  return (profile.admin_role as AdminRole) ?? "super_admin";
}

// Check if an admin has at least the required role.
// Permission hierarchy: super_admin > finance > support
const ROLE_LEVEL: Record<string, number> = {
  super_admin: 3,
  finance:     2,
  support:     1,
};

export function hasAdminPermission(userRole: AdminRole, required: "super_admin" | "finance" | "support"): boolean {
  if (!userRole) return false;
  return (ROLE_LEVEL[userRole] ?? 0) >= (ROLE_LEVEL[required] ?? 0);
}
