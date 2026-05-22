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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use direct REST API to guarantee the write bypasses any client-level issues
  const payload = { ...updates, updated_at: new Date().toISOString() };
  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const resText = await res.text();
  console.log("[admin/users PATCH] REST status:", res.status, "body:", resText.slice(0, 300));

  if (!res.ok) {
    console.error("[api/admin/users PATCH] REST error:", res.status, resText);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // If no rows were updated (empty array returned), insert a minimal profile row
  const rows = JSON.parse(resText || "[]");
  if (rows.length === 0) {
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ id: userId, ...updates }),
        cache: "no-store",
      }
    );
    const insertText = await insertRes.text();
    console.log("[admin/users PATCH] INSERT status:", insertRes.status, "body:", insertText.slice(0, 300));
    if (!insertRes.ok) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
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
