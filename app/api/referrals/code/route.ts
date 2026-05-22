import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 7) {
  let code = "";
  for (let i = 0; i < len; i++) code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  return code;
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check if user already has a code
  const { data: profile } = await admin
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();

  if (profile?.referral_code) {
    return NextResponse.json({ code: profile.referral_code });
  }

  // Generate a unique code
  let code = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomCode();
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", candidate)
      .maybeSingle();
    if (!existing) { code = candidate; break; }
  }

  if (!code) return NextResponse.json({ error: "Could not generate code" }, { status: 500 });

  await admin.from("profiles").update({ referral_code: code }).eq("id", user.id);

  return NextResponse.json({ code });
}
