import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const supabase = getAdmin();
  const { data, error } = await supabase
    .from("call_sheets")
    .select("id, title, shoot_date, data, project:projects(id, title)")
    .eq("share_token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Call sheet not found" }, { status: 404 });
  return NextResponse.json(data);
}
