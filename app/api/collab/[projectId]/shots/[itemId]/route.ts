import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ projectId: string; itemId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId, itemId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: collab } = await supabase
      .from("project_collaborators")
      .select("id, permissions")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!collab) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!(collab.permissions as string[]).includes("mark_shots")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await req.json() as { is_complete: boolean; completion_note?: string };

    const patch: Record<string, unknown> = {
      is_complete: body.is_complete,
      updated_at: new Date().toISOString(),
    };
    if (typeof body.completion_note === "string") {
      patch.completion_note = body.completion_note.trim() || null;
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("shot_list_items")
      .update(patch)
      .eq("id", itemId);

    if (error) {
      console.error("[collab shots PATCH]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[collab shots PATCH]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
