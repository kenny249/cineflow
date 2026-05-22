import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getAdmin();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function POST() {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdmin();
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const expired = (users ?? []).filter(
    (u) => u.email?.endsWith("@demo.usecineflow.com") && u.created_at < cutoff
  );

  let deleted = 0;
  for (const u of expired) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (!error) deleted++;
  }

  console.log(`[admin/purge-demos] deleted ${deleted} of ${expired.length} expired demos`);
  return NextResponse.json({ deleted });
}
