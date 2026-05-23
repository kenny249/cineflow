import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Temporary diagnostic endpoint — remove after fixing the data issue
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  // What does get_workspace_owner_id() return for this user?
  const { data: wsOwner } = await admin.rpc("get_workspace_owner_id" as any);

  // What does the profile look like?
  const { data: profile } = await admin
    .from("profiles")
    .select("id, workspace_id, plan, first_name, last_name")
    .eq("id", user.id)
    .single();

  // How many projects does the admin client see for this user?
  const { count: adminCount } = await admin
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user.id)
    .is("deleted_at", null);

  // How many projects does the USER client see (respects RLS)?
  const { data: userProjects, error: userError } = await supabase
    .from("projects")
    .select("id, title, created_by, deleted_at")
    .is("deleted_at", null);

  return NextResponse.json({
    auth_uid: user.id,
    user_email: user.email,
    profile,
    workspace_owner_id: wsOwner,
    admin_project_count: adminCount,
    user_visible_projects: userProjects ?? [],
    user_rls_error: userError?.message ?? null,
  });
}
