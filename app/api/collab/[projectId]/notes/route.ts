import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
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

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("project_notes")
      .select("id, title, content, author_id, pinned, created_at, updated_at")
      .eq("project_id", projectId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[collab notes GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: collab } = await supabase
      .from("project_collaborators")
      .select("id, name, permissions")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!collab) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!(collab.permissions as string[]).includes("add_notes")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await req.json() as { content: string; title?: string };
    const content = body.content?.trim();
    if (!content) return NextResponse.json({ error: "Content required" }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("project_notes")
      .insert({
        project_id: projectId,
        author_id: user.id,
        created_by: user.id,
        author_name: collab.name,
        title: body.title?.trim() || null,
        content,
      })
      .select()
      .single();

    if (error) {
      console.error("[collab notes POST]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[collab notes POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
