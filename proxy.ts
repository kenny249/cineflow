import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  "/invite",
  "/portal",
  "/review",
  "/sign",
  "/pay",
  "/board",
  "/client",
  "/forms",
  "/quote",
  "/privacy",
  "/terms",
  "/update-password",
  "/api/auth",
  "/api/demo",
  "/share",
  "/api/share",
  "/maintenance",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/_next/")) return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?")
  );
}

// ── Module-level caches (30s TTL) ───────────────────────────────────────────

let _maint: { on: boolean; msg: string; at: number } | null = null;
let _gated: { keys: Set<string>; at: number } | null = null;
const CACHE_MS = 30_000;

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getMaintenance(): Promise<{ on: boolean; msg: string }> {
  const now = Date.now();
  if (_maint && now - _maint.at < CACHE_MS) return _maint;
  try {
    const { data } = await adminClient()
      .from("site_settings")
      .select("maintenance_mode, maintenance_message")
      .eq("id", 1)
      .single();
    _maint = { on: data?.maintenance_mode ?? false, msg: data?.maintenance_message ?? "", at: now };
  } catch {
    _maint = { on: false, msg: "", at: now };
  }
  return _maint!;
}

async function getGatedKeys(): Promise<Set<string>> {
  const now = Date.now();
  if (_gated && now - _gated.at < CACHE_MS) return _gated.keys;
  try {
    const { data } = await adminClient()
      .from("feature_flags")
      .select("key")
      .eq("gated", true)
      .eq("enabled", true);
    _gated = { keys: new Set((data ?? []).map((f: { key: string }) => f.key)), at: now };
  } catch {
    _gated = { keys: new Set(), at: now };
  }
  return _gated!.keys;
}

async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const { data } = await adminClient()
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .single();
    return data?.is_admin === true;
  } catch {
    return false;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Per-request admin check — calls DB at most once per request
  let _adminResult: boolean | null = null;
  const getIsAdmin = async (): Promise<boolean> => {
    if (!user) return false;
    if (_adminResult !== null) return _adminResult;
    _adminResult = await checkIsAdmin(user.id);
    return _adminResult;
  };

  // 1. Maintenance mode — check site_settings (cached 30s)
  const maint = await getMaintenance();
  if (maint.on && !isPublic(pathname)) {
    if (!await getIsAdmin()) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.redirect(url);
    }
  }

  // 2. Gated pages — check feature_flags (cached 30s), only for authenticated users
  if (user && !isPublic(pathname)) {
    const key = pathname.slice(1).split("/")[0];
    if (key) {
      const gated = await getGatedKeys();
      if (gated.has(key)) {
        if (!await getIsAdmin()) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // 3. Auth redirect
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const proxyConfig = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
