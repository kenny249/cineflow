import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/privacy",
  "/review",
  "/forms",
  "/sign",
  "/pay",
  "/board",
  "/client",
  "/portal",
  "/collab",
  "/auth",
  "/api",
  "/_next",
  "/favicon",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes and static assets
  if (isPublic(pathname) || pathname === "/") {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-in user hitting /login → send to appropriate home
  if (user && pathname.startsWith("/login")) {
    // Check if collaborator — redirect to collab view instead of dashboard
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_collaborator")
      .eq("id", user.id)
      .single();
    const dest = profile?.is_collaborator ? "/collab" : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Unauthenticated user hitting a protected route → send to login
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Collaborator trying to access main app → redirect to their view
  if (user && !pathname.startsWith("/collab")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_collaborator")
      .eq("id", user.id)
      .single();
    if (profile?.is_collaborator) {
      return NextResponse.redirect(new URL("/collab", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)).*)",
  ],
};
