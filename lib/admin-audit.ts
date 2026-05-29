import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function logAdminAction(params: {
  actorId: string;
  action: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await getAdmin().from("admin_audit_log").insert({
      actor_id:    params.actorId,
      action:      params.action,
      target_id:   params.targetId ?? null,
      target_type: params.targetType ?? null,
      metadata:    params.metadata ?? null,
    });
  } catch (err) {
    console.error("[admin-audit] Failed to log action:", err);
  }
}
