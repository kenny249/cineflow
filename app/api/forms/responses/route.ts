import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/forms/responses?form_id=xxx — get all responses for a form
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formId = req.nextUrl.searchParams.get("form_id");
  if (!formId) return NextResponse.json({ error: "form_id required" }, { status: 400 });

  // Verify ownership
  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("form_responses")
    .select("*")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ responses: data });
}
