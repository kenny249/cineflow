import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getAdminRole } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Mark (or unmark) one feedback submission as resolved, so already-actioned
// requests stop looking like they still need work.
export async function PATCH(req: NextRequest) {
  const role = await getAdminRole();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, resolved } = await req.json();
  if (!id || typeof resolved !== "boolean") {
    return NextResponse.json({ error: "id and resolved (boolean) required" }, { status: 400 });
  }

  const admin = getAdmin();
  const { error } = await admin
    .from("feedback")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
