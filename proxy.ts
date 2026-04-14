import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;

// Routes that are always public (no auth required)
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/welcome",
  "/auth",          // /auth/callback
  "/board",         // public storyboard share
  "/review",        // public client review portal
  "/pay",           // public invoice pay page
  "/forms",         // public client intake forms
  "/sign",          // public contract signing
  "/opengraph-image",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // Always skip Next.js internals, static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isLoggedIn = Boolean(session);

  // If the path is public, let it through (but redirect logged-in users away from login/signup)
  if (isPublicPath(pathname)) {
    if (isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
      return NextResponse.redirect(new URL("/dashboard", origin));
    }
    return response;
  }

  // Protected: redirect unauthenticated users to login
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const proxyConfig = {
  matcher: ["/((?!_next|static|api|.*\\..*).*)"],
};
