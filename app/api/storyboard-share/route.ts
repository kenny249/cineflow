import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { project_id, title, frames } = await req.json();
    if (!project_id || !frames) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify caller is authenticated and owns the project
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("created_by", user.id)
      .single();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 403 });
    }

    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const { data, error } = await supabase
      .from("storyboard_shares")
      .insert({ project_id, title, frames, token, created_by: user.id })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ token: data.token });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to create share" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("storyboard_shares")
      .select("*")
      .eq("token", token)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
