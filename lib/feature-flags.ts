import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function isFeatureEnabled(
  key: string,
  context?: { userId?: string; plan?: string }
): Promise<boolean> {
  try {
    const supabase = getAdmin();
    const { data: flag } = await supabase
      .from("feature_flags")
      .select("enabled, user_ids, plans")
      .eq("key", key)
      .single();

    if (!flag) return false;
    if (!flag.enabled) return false;

    // If user_ids is set, check user-level targeting
    if (flag.user_ids?.length && context?.userId) {
      if (flag.user_ids.includes(context.userId)) return true;
    }

    // If plans is set, check plan-level targeting
    if (flag.plans?.length && context?.plan) {
      if (flag.plans.includes(context.plan)) return true;
    }

    // No targeting restrictions — flag is globally enabled
    if (!flag.user_ids?.length && !flag.plans?.length) return true;

    return false;
  } catch {
    return false;
  }
}
