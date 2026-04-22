import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { email, plan } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const trimmedEmail = email.trim().toLowerCase();

    // Find existing user
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existing = users.find((u) => u.email?.toLowerCase() === trimmedEmail);

    if (existing) {
      // If they exist but email isn't confirmed, confirm them now
      if (!existing.email_confirmed_at) {
        await supabase.auth.admin.updateUserById(existing.id, {
          email_confirm: true,
          user_metadata: existing.user_metadata,
        });
      }
    } else {
      // New user — create and auto-confirm so OTP goes out immediately
      const { error } = await supabase.auth.admin.createUser({
        email: trimmedEmail,
        email_confirm: true,
        user_metadata: { plan: plan ?? "studio_beta" },
      });
      if (error && !error.message.includes("already registered")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    // Now trigger the OTP — user is confirmed so Supabase sends the 6-digit code
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: otpError } = await anonClient.auth.signInWithOtp({
      email: trimmedEmail,
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      console.error("[api/auth/otp]", otpError);
      return NextResponse.json({ error: otpError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/otp]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
