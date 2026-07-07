import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("call_sheets")
    .select("id, title, shoot_date, share_token, created_at, updated_at")
    .eq("project_id", projectId)
    .order("shoot_date", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project_id, title, shoot_date, data } = await req.json();
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("call_sheets")
    .insert({ project_id, title: title ?? "Call Sheet", shoot_date: shoot_date ?? null, data: data ?? {}, created_by: user.id })
    .select("id, title, shoot_date, share_token, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(row);
}
