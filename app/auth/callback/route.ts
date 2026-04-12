import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function buildProfilePayload(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  const firstName = typeof metadata.first_name === "string" ? metadata.first_name : undefined;
  const lastName = typeof metadata.last_name === "string" ? metadata.last_name : undefined;
  const fullName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : [firstName, lastName].filter(Boolean).join(" ") || user.email;
  const company = typeof metadata.company === "string" ? metadata.company : undefined;

  return {
    id: user.id,
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    company,
    updated_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") ?? "magiclink";
  const code       = searchParams.get("code");
  const next       = searchParams.get("next") ?? "/welcome";

  // Build the redirect response up-front so cookies are written directly onto it.
  const redirectResponse = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>
        ) {
          // Write session cookies directly onto the redirect response so the
          // browser receives them in the same round-trip and the session is
          // available immediately after the redirect lands.
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(
              name,
              value,
              options as Parameters<typeof redirectResponse.cookies.set>[2]
            );
          });
        },
      },
    }
  );

  // ── Path 1: token_hash (new email template — most reliable) ─────────────────
  // The email link goes directly to this route with ?token_hash=xxx&type=magiclink.
  // No PKCE verifier, no redirect URL matching, works from any device/email app.
  if (token_hash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
    });

    if (error || !data.user) {
      console.error("verifyOtp error:", error);
      return NextResponse.redirect(new URL("/login?error=invalid_token", origin));
    }

    try {
      await supabase
        .from("profiles")
        .upsert(buildProfilePayload(data.user), { onConflict: "id" });
    } catch (e) {
      console.error("Profile upsert error:", e);
    }

    return redirectResponse;
  }

  // ── Path 2: PKCE code (OAuth providers, same-browser magic links) ────────────
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      console.error("exchangeCodeForSession error:", error);
      return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
    }

    try {
      await supabase
        .from("profiles")
        .upsert(buildProfilePayload(data.user), { onConflict: "id" });
    } catch (e) {
      console.error("Profile upsert error:", e);
    }

    return redirectResponse;
  }

  // Nothing to work with
  return NextResponse.redirect(new URL("/login?error=missing_token", origin));
}
