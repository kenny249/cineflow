import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/review/[token]/deliverables
// Returns the project_deliverables for a given review token.
// No auth required — access is implicitly gated by possession of a valid active token.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  // Validate the token first
  const { data: tokenRow, error: tokenError } = await supabase
    .from("review_tokens")
    .select("project_id")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("project_deliverables")
    .select("id, label, done, sort_order")
    .eq("project_id", tokenRow.project_id)
    .order("sort_order")
    .order("created_at");

  if (error) {
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(data ?? []);
}
