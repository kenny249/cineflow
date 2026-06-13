import { createClient } from "@supabase/supabase-js";
import { requireAdminPage } from "@/lib/admin-guard";
import { FeatureFlagsClient } from "./FeatureFlagsClient";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function FeatureFlagsPage() {
  await requireAdminPage();
  const supabase = getAdmin();

  const { data: flags } = await supabase
    .from("feature_flags")
    .select("id, key, description, enabled, show_new_badge, user_ids, plans, updated_at")
    .order("key");

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Feature Flags</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Control feature rollouts per plan or user</p>
      </div>
      <FeatureFlagsClient initial={flags ?? []} />
    </div>
  );
}
