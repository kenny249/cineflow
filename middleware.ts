import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

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
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Temporarily disable auth enforcement for development
  // const isLoggedIn = Boolean(session);
  // const isAuthRoute = pathname === "/login" || pathname === "/signup";
  // const isProtectedRoute =
  //   pathname === "/" ||
  //   pathname.startsWith("/dashboard") ||
  //   pathname.startsWith("/projects") ||
  //   pathname.startsWith("/revisions") ||
  //   pathname.startsWith("/settings") ||
  //   pathname.startsWith("/storyboard") ||
  //   pathname.startsWith("/shot-lists") ||
  //   pathname.startsWith("/calendar");

  // if (!isLoggedIn && isProtectedRoute) {
  //   const loginUrl = new URL("/login", origin);
  //   loginUrl.searchParams.set("redirectedFrom", pathname);
  //   return NextResponse.redirect(loginUrl);
  // }

  // if (isLoggedIn && isAuthRoute) {
  //   return NextResponse.redirect(new URL("/dashboard", origin));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|static|api|.*\\..*).*)"],
};
