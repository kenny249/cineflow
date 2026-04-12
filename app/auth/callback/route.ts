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
  const fullName = typeof metadata.full_name === "string"
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
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/welcome";
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=missing_code`, origin));
  }

  // Build the redirect response first so we can set cookies directly on it
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
          // Set cookies directly on the redirect response so the session survives
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(new URL(`/login?error=auth_callback_failed`, origin));
  }

  // Upsert profile
  try {
    await supabase
      .from("profiles")
      .upsert(buildProfilePayload(data.user), { onConflict: "id" });
  } catch (profileError) {
    console.error("Profile upsert error:", profileError);
  }

  return redirectResponse;
}
