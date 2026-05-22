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

// PATCH — update a user's plan or other profile fields
export async function PATCH(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, updates } = await req.json();
  if (!userId || !updates) return NextResponse.json({ error: "userId and updates required" }, { status: 400 });

  // Prevent admins from revoking their own admin status
  if ("is_admin" in updates && updates.is_admin === false && userId === caller.id) {
    return NextResponse.json({ error: "You cannot revoke your own admin access." }, { status: 403 });
  }

  const admin = getAdmin();
  const { error } = await admin
    .from("profiles")
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) {
    console.error("[api/admin/users PATCH]", error.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE — permanently delete a user and all their data
export async function DELETE(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const admin = getAdmin();

  // Safety: never delete an admin account
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userId).single();
  if (profile?.is_admin) return NextResponse.json({ error: "Cannot delete an admin account" }, { status: 403 });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[api/admin/users DELETE]", error.message);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
