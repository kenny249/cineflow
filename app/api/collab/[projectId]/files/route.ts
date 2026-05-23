import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ projectId: string }> };

// Categories safe to share with crew — exclude deal memos and contracts
const CREW_CATEGORIES = new Set(["call-sheets", "breakdowns", "schedules", "notes", "other"]);

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
      .from("project_files")
      .select("id, name, category, public_url, size, mime_type, created_at")
      .eq("project_id", projectId)
      .eq("tab", "docs")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const filtered = (data ?? []).filter((f) => CREW_CATEGORIES.has(f.category ?? "other"));
    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[collab files GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
