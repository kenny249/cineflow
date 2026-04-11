import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { project_id, title, frames } = await req.json();
    if (!project_id || !frames) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createClient();
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const { data, error } = await supabase
      .from("storyboard_shares")
      .insert({ project_id, title, frames, token })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ token: data.token });
  } catch (err: any) {
    console.error("Share error:", err);
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
