import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ projectId: string; taskId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: collab } = await supabase
      .from("project_collaborators")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!collab) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json() as { status: string };
    const valid = ["todo", "in_progress", "done"];
    if (!valid.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("project_tasks")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("project_id", projectId);

    if (error) {
      console.error("[collab task PATCH]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[collab task PATCH]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
