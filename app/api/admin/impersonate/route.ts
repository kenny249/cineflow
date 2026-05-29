import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logAdminAction } from "@/lib/admin-audit";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getAdmin();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function POST(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Never impersonate another admin
  const admin = getAdmin();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userId).single();
  if (profile?.is_admin) return NextResponse.json({ error: "Cannot impersonate an admin account" }, { status: 403 });

  const { data: authData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !authData?.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authData.user.email,
    options: { redirectTo: `${siteUrl}/dashboard` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[api/admin/impersonate]", linkError);
    return NextResponse.json({ error: "Failed to generate link" }, { status: 500 });
  }

  await logAdminAction({
    actorId: caller.id,
    action: "impersonate_user",
    targetId: userId,
    targetType: "user",
  });

  return NextResponse.json({ link: linkData.properties.action_link, email: authData.user.email });
}
