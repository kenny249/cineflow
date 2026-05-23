import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; dayId: string }> };

// GET — list crew calls for a shoot day
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: projectId, dayId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("shoot_day_crew_calls")
      .select("*")
      .eq("shoot_day_id", dayId)
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[crew-calls GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — add a crew call
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: projectId, dayId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      collaborator_id?: string | null;
      name: string;
      role?: string | null;
      call_time: string;
    };

    if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (!body.call_time?.trim()) return NextResponse.json({ error: "Call time required" }, { status: 400 });

    const { data, error } = await supabase
      .from("shoot_day_crew_calls")
      .insert({
        shoot_day_id: dayId,
        project_id: projectId,
        collaborator_id: body.collaborator_id ?? null,
        name: body.name.trim(),
        role: body.role?.trim() || null,
        call_time: body.call_time.trim(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[crew-calls POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE — remove a crew call
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id: projectId, dayId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const crewCallId = req.nextUrl.searchParams.get("crewCallId");
    if (!crewCallId) return NextResponse.json({ error: "crewCallId required" }, { status: 400 });

    const { error } = await supabase
      .from("shoot_day_crew_calls")
      .delete()
      .eq("id", crewCallId)
      .eq("shoot_day_id", dayId)
      .eq("project_id", projectId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[crew-calls DELETE]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
