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

    const [daysRes, crewCallsRes] = await Promise.all([
      admin
        .from("shoot_days")
        .select("id, day_number, date, general_call, location, notes, created_at")
        .eq("project_id", projectId)
        .order("day_number", { ascending: true }),
      admin
        .from("shoot_day_crew_calls")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (daysRes.error) return NextResponse.json({ error: daysRes.error.message }, { status: 500 });

    const crewCalls = crewCallsRes.data ?? [];
    const shootDays = (daysRes.data ?? []).map((day) => ({
      ...day,
      crew_calls: crewCalls.filter((cc) => cc.shoot_day_id === day.id),
    }));

    return NextResponse.json({ my_collaborator_id: collab.id, shoot_days: shootDays });
  } catch (err) {
    console.error("[collab schedule GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
