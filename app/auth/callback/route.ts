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

function errorPage(title: string, detail: string, origin: string) {
  const loginUrl = `${origin}/login`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign-in error — CineFlow</title>
  <style>
    body { background: #060606; color: #fff; font-family: system-ui, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; padding: 1.5rem; box-sizing: border-box; }
    .card { max-width: 420px; width: 100%; border: 1px solid rgba(255,255,255,.1);
            border-radius: 1.5rem; padding: 2.5rem 2rem; background: #111; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 .75rem; color: #f87171; }
    p  { font-size: .875rem; color: #71717a; margin: 0 0 .5rem; }
    pre{ font-size: .75rem; color: #a1a1aa; background: #1a1a1a;
         border-radius: .75rem; padding: 1rem; text-align: left;
         overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 1rem 0; }
    a  { display: inline-block; margin-top: 1.5rem; padding: .75rem 2rem;
         border: 1px solid rgba(255,255,255,.1); border-radius: .75rem;
         color: #d4a853; text-decoration: none; font-size: .875rem; }
    a:hover { border-color: rgba(212,168,83,.4); }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>Your magic link may have expired or already been used.</p>
    <pre>${detail}</pre>
    <p style="color:#52525b;font-size:.75rem">Request a fresh link from the login page.</p>
    <a href="${loginUrl}">← Back to login</a>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const token_hash = searchParams.get("token_hash");
  const typeParam  = searchParams.get("type") ?? "email";
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

  // ── Path 1: token_hash (email template with ?token_hash=xxx&type=email) ───────
  if (token_hash) {
    // Supabase stores magic link OTPs as type "email". Try that first,
    // then fall back to "magiclink" for backwards compat with older templates.
    const typesToTry = typeParam === "email"
      ? (["email", "magiclink"] as const)
      : (["magiclink", "email"] as const);

    let user = null;
    let lastError: { message?: string } | null = null;

    for (const t of typesToTry) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: t as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
      });
      if (!error && data.user) {
        user = data.user;
        break;
      }
      lastError = error ?? { message: "No user returned" };
    }

    if (!user) {
      console.error("verifyOtp failed for all types:", lastError);
      return errorPage(
        "Magic link failed",
        `token_hash present, type attempts: ${typesToTry.join(", ")}\nError: ${lastError?.message ?? "unknown"}`,
        origin
      );
    }

    try {
      await supabase
        .from("profiles")
        .upsert(buildProfilePayload(user), { onConflict: "id" });
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
      return errorPage(
        "Sign-in failed",
        `exchangeCodeForSession error: ${error?.message ?? "No user returned"}`,
        origin
      );
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

  // Nothing to work with — show what params actually arrived
  const allParams = Object.fromEntries(searchParams.entries());
  return errorPage(
    "Missing authentication token",
    `No token_hash or code found.\nQuery params received: ${JSON.stringify(allParams, null, 2)}`,
    origin
  );
}
