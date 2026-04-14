import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/forms/[token] — public: fetch form + agency branding
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getAdmin();

  const { data: form, error } = await supabase
    .from("forms")
    .select("id, title, description, questions, status, token, created_by")
    .eq("token", token)
    .eq("status", "active")
    .maybeSingle();

  if (error || !form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  // Fetch agency branding from the form owner's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, company, full_name, logo_url")
    .eq("id", form.created_by)
    .maybeSingle();

  const agencyName = profile?.business_name || profile?.company || profile?.full_name || "Studio";

  return NextResponse.json({
    form: {
      id: form.id,
      title: form.title,
      description: form.description,
      questions: form.questions,
      token: form.token,
    },
    agency: {
      name: agencyName,
      logo_url: profile?.logo_url ?? null,
    },
  });
}

// POST /api/forms/[token] — public: submit a response
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getAdmin();

  let body: { respondent_name?: string; respondent_email?: string; answers: Record<string, string | string[]> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "answers required" }, { status: 400 });
  }

  // Resolve form
  const { data: form, error: formErr } = await supabase
    .from("forms")
    .select("id, status, questions")
    .eq("token", token)
    .eq("status", "active")
    .maybeSingle();

  if (formErr || !form) return NextResponse.json({ error: "Form not found or closed" }, { status: 404 });

  // Validate required fields
  const questions = form.questions as Array<{ id: string; required?: boolean; question: string }>;
  for (const q of questions) {
    if (q.required) {
      const val = body.answers[q.id];
      const isEmpty = !val || (Array.isArray(val) ? val.length === 0 : val.trim() === "");
      if (isEmpty) {
        return NextResponse.json({ error: `"${q.question}" is required.` }, { status: 422 });
      }
    }
  }

  // Insert response
  const { error: insertErr } = await supabase.from("form_responses").insert({
    form_id: form.id,
    respondent_name: body.respondent_name?.trim() || null,
    respondent_email: body.respondent_email?.trim() || null,
    answers: body.answers,
  });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Increment response_count
  await supabase.rpc("increment_form_response_count", { form_id: form.id }).maybeSingle();

  return NextResponse.json({ success: true });
}
