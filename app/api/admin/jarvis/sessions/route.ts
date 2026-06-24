import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getAdmin();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

// Fire-and-forget: summarise session with Haiku and save for cross-session memory
async function saveSessionSummary(messages: any[], adminId: string, commandCount: number) {
  try {
    const transcript = messages
      .slice(0, 24)
      .map((m: any) => `${m.role === "user" ? "Kenny" : "Jarvis"}: ${m.text}`)
      .join("\n");

    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 130,
      messages: [{
        role: "user",
        content: `Summarize this Cineflow admin session in 1-2 short sentences. Focus on what was discussed, any key data or user actions taken, and decisions made. Be specific with names/numbers if present.\n\n${transcript.slice(0, 3500)}`,
      }],
    });

    const summary = (resp.content.find((b: any) => b.type === "text") as any)?.text?.trim() ?? "";
    if (!summary) return;

    const admin = getAdmin();
    await admin.from("jarvis_session_summaries").insert({
      admin_id: adminId,
      summary,
      command_count: commandCount ?? 0,
    });
  } catch {
    // Non-critical — session is already saved, summary is best-effort
  }
}

export async function GET() {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdmin();
  const { data, error } = await admin
    .from("jarvis_sessions")
    .select("id, command_count, duration_ms, created_at, messages")
    .eq("admin_id", caller.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = getAdmin();
  const { error } = await admin
    .from("jarvis_sessions")
    .delete()
    .eq("id", id)
    .eq("admin_id", caller.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

export async function POST(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { messages, commandCount, durationMs } = await req.json();
  if (!messages?.length) return NextResponse.json({ error: "No messages" }, { status: 400 });

  const admin = getAdmin();
  const { error } = await admin.from("jarvis_sessions").insert({
    admin_id: caller.id,
    messages,
    command_count: commandCount ?? 0,
    duration_ms: durationMs ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate and save a session summary asynchronously — non-blocking
  saveSessionSummary(messages, caller.id, commandCount);

  return NextResponse.json({ saved: true });
}
