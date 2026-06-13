import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Returns the set of flag keys where show_new_badge = true.
// Used by the sidebar to render gold "NEW" badges on nav items.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ badgeKeys: [] });

  const admin = getAdmin();
  const { data } = await admin
    .from("feature_flags")
    .select("key")
    .eq("show_new_badge", true)
    .eq("enabled", true);

  const badgeKeys: string[] = (data ?? []).map((f: { key: string }) => f.key);
  return NextResponse.json({ badgeKeys });
}
