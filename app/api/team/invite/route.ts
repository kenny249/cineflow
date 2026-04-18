import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only workspace owners can invite
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.workspace_id !== user.id) {
    return NextResponse.json({ error: "Only workspace owners can invite members" }, { status: 403 });
  }

  const body = await req.json();
  const { email, name, role = "member" } = body as { email: string; name?: string; role?: string };
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const admin = createAdminClient();

  // Create pending team_members row first
  const { data: member, error: insertError } = await supabase
    .from("team_members")
    .insert({
      email: email.trim().toLowerCase(),
      name: name?.trim() || null,
      role,
      status: "pending",
      invited_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "This email is already on your team" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Send the real invite email via Supabase admin
  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo: `${origin}/auth/callback?type=invite&next=/team`,
    data: {
      workspace_id: user.id,
      workspace_role: role,
      invited_as: name?.trim() || null,
    },
  });

  if (inviteError) {
    // Roll back the team_members row if invite email failed
    await supabase.from("team_members").delete().eq("id", member.id);
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  return NextResponse.json(member, { status: 201 });
}
