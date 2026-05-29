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

// GET /api/admin/notes?userId=xxx
export async function GET(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const admin = getAdmin();
  const { data: notes, error } = await admin
    .from("admin_notes")
    .select("id, body, created_at, author_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/admin/notes GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch author names
  const authorIds = [...new Set((notes ?? []).map((n) => n.author_id))];
  const authorNames: Record<string, string> = {};
  if (authorIds.length > 0) {
    const { data: authors } = await admin
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", authorIds);
    for (const a of authors ?? []) {
      authorNames[a.id] = [a.first_name, a.last_name].filter(Boolean).join(" ") || "Admin";
    }
  }

  return NextResponse.json({
    notes: (notes ?? []).map((n) => ({ ...n, author_name: authorNames[n.author_id] ?? "Admin" })),
  });
}

// POST /api/admin/notes
export async function POST(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, body } = await req.json();
  if (!userId || !body?.trim()) {
    return NextResponse.json({ error: "userId and body required" }, { status: 400 });
  }

  const admin = getAdmin();
  const { data: note, error } = await admin
    .from("admin_notes")
    .insert({ user_id: userId, author_id: caller.id, body: body.trim() })
    .select("id, body, created_at, author_id")
    .single();

  if (error) {
    console.error("[api/admin/notes POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ note });
}

// DELETE /api/admin/notes?id=xxx
export async function DELETE(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = getAdmin();
  const { error } = await admin.from("admin_notes").delete().eq("id", id);
  if (error) {
    console.error("[api/admin/notes DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
