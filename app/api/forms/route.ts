import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTemplateQuestions, type FormTemplateId } from "@/lib/forms-template";

// GET /api/forms — list user's forms
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("forms")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ forms: data });
}

// POST /api/forms — create a new form from a template
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; description?: string; template?: FormTemplateId } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const templateId: FormTemplateId = body.template ?? "production_intake";
  const questions = getTemplateQuestions(templateId);

  const defaultTitles: Record<FormTemplateId, string> = {
    production_intake:  "Production Intake",
    talent_intake:      "Talent Intake",
    location_scouting:  "Location Scouting",
    client_feedback:    "Client Feedback",
    event_coverage:     "Event Coverage Brief",
    revision_request:   "Revision Request",
    blank:              "Untitled Form",
  };

  const title = body.title?.trim() || defaultTitles[templateId] || "Untitled Form";

  const { data, error } = await supabase
    .from("forms")
    .insert({
      created_by: user.id,
      title,
      description: body.description?.trim() || null,
      questions,
      status: "active",
      token: crypto.randomUUID(),
      response_count: 0,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ form: data }, { status: 201 });
}

// PATCH /api/forms — update title, description, status, or questions
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id: string; [key: string]: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { id, ...updates } = body;

  const { data, error } = await supabase
    .from("forms")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("created_by", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ form: data });
}

// DELETE /api/forms?id=xxx
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("forms")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
