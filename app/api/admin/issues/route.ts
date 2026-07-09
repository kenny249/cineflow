import { NextRequest, NextResponse } from "next/server";
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

// GET → unresolved issues (last 14 days) + counts
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = getAdmin();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("platform_issues")
    .select("id, kind, severity, message, context, created_at")
    .eq("resolved", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ issues: data ?? [] });
}

// PATCH { id } → mark resolved
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { id?: string; resolveAll?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const admin = getAdmin();
  if (body.resolveAll) {
    await admin.from("platform_issues").update({ resolved: true }).eq("resolved", false);
  } else if (body.id) {
    await admin.from("platform_issues").update({ resolved: true }).eq("id", body.id);
  } else {
    return NextResponse.json({ error: "id or resolveAll required" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
