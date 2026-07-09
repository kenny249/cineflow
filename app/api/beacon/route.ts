import { NextRequest, NextResponse } from "next/server";
import { logIssue } from "@/lib/log-issue";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

// Public endpoint: client-side public pages (review / pay / quote / sign) POST
// here when they hit an error the user can see (e.g. a portal that won't load).
// Input is untrusted, so we hard-cap and whitelist everything before storing.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`beacon:${ip}`, 20, 60_000)) {
    return NextResponse.json({ ok: true }); // silently drop — never error the client
  }

  let body: { page?: string; status?: number; message?: string; token?: string; ref?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const page = String(body.page ?? "").slice(0, 200);
  const status = Number.isFinite(body.status) ? Number(body.status) : undefined;
  const ref = String(body.ref ?? "").slice(0, 60); // e.g. "review", "pay"
  // Only keep a token prefix — never store full tokens.
  const tokenHint = body.token ? String(body.token).slice(0, 8) : undefined;
  const message = `Client hit an error on ${ref || "a public page"}${status ? ` (${status})` : ""}`;

  await logIssue({
    kind: "public_page_error",
    message,
    context: { page, status, ref, tokenHint, detail: String(body.message ?? "").slice(0, 200) },
  });

  return NextResponse.json({ ok: true });
}
