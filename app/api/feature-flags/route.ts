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

// Returns badgeKeys (active NEW badges) and gatedKeys (pages blocked for non-admins)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ badgeKeys: [], gatedKeys: [] });

  const admin = getAdmin();
  const now = new Date().toISOString();

  const [badgeResult, gatedResult] = await Promise.all([
    admin
      .from("feature_flags")
      .select("key")
      .eq("show_new_badge", true)
      .eq("enabled", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`),
    admin
      .from("feature_flags")
      .select("key")
      .eq("gated", true)
      .eq("enabled", true),
  ]);

  const badgeKeys: string[] = (badgeResult.data ?? []).map((f: { key: string }) => f.key);
  const gatedKeys: string[] = (gatedResult.data ?? []).map((f: { key: string }) => f.key);

  return NextResponse.json({ badgeKeys, gatedKeys });
}
