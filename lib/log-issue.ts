import { createClient } from "@supabase/supabase-js";

export type IssueKind = "public_page_error" | "email_failed" | "payment_error" | "server_error" | "other";

/**
 * Records a platform issue for the admin Issues panel. Uses the service role and
 * is fully fire-and-forget: it NEVER throws, so a failure here can never break
 * the request that reported the problem. Call it from server code (API routes,
 * webhooks) — not the client.
 */
export async function logIssue(params: {
  kind: IssueKind;
  message: string;
  severity?: "error" | "warning";
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    await admin.from("platform_issues").insert({
      kind: params.kind,
      severity: params.severity ?? "error",
      message: params.message.slice(0, 500),
      context: params.context ?? {},
    });
  } catch {
    // Deliberately swallowed — logging an issue must never cause one.
  }
}
