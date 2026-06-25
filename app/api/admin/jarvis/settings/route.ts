import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export async function GET() {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getAdmin();
  const { data } = await admin
    .from("jarvis_settings")
    .select("personality, voice_speed")
    .eq("admin_id", caller.id)
    .single();

  return NextResponse.json({
    personality: data?.personality ?? null,
    voiceSpeed: typeof data?.voice_speed === "number" ? data.voice_speed : null,
  });
}

export async function POST(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { personality, voiceSpeed } = await req.json();
  const admin = getAdmin();

  const { error } = await admin
    .from("jarvis_settings")
    .upsert({
      admin_id: caller.id,
      personality: personality ?? { humor: 50, energy: 50, formality: 50 },
      voice_speed: Math.max(0.7, Math.min(1.4, voiceSpeed ?? 1.0)),
      updated_at: new Date().toISOString(),
    }, { onConflict: "admin_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}
