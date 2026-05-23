import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canInviteCollaborators } from "@/lib/billing";

type Params = { params: Promise<{ id: string }> };

// GET — list collaborators for a project
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("project_collaborators")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[collaborators GET]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[collaborators GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — invite a collaborator to a project
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check plan allows collaborator invites (Studio+ only)
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (!canInviteCollaborators(profile?.plan)) {
      return NextResponse.json(
        { error: "Upgrade to Studio or higher to invite collaborators" },
        { status: 403 }
      );
    }

    // Verify the project belongs to this user's workspace
    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .select("id, title, client_name")
      .eq("id", projectId)
      .single();

    if (projectErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json() as { email: string; name: string };
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    // Insert pending collaborator row
    const { data: collab, error: insertErr } = await supabase
      .from("project_collaborators")
      .insert({ project_id: projectId, invited_by: user.id, email, name, status: "pending" })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: "This person has already been invited to this project" }, { status: 409 });
      }
      console.error("[collaborators POST] insert", insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Send invite email via Supabase admin
    const admin = createAdminClient();
    const origin = (req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();

    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?type=collab_invite&project_id=${projectId}&next=/collab`,
      data: {
        is_collaborator: true,
        project_id: projectId,
        project_title: project.title,
        invited_as: name,
        invited_by_id: user.id,
      },
    });

    if (inviteErr) {
      console.error("[collaborators POST] invite email", inviteErr.message);
      await supabase.from("project_collaborators").delete().eq("id", collab.id);
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }

    return NextResponse.json(collab, { status: 201 });
  } catch (err) {
    console.error("[collaborators POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE — remove a collaborator
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const collaboratorId = req.nextUrl.searchParams.get("collaboratorId");
    if (!collaboratorId) return NextResponse.json({ error: "collaboratorId required" }, { status: 400 });

    const { error } = await supabase
      .from("project_collaborators")
      .delete()
      .eq("id", collaboratorId)
      .eq("project_id", projectId);

    if (error) {
      console.error("[collaborators DELETE]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[collaborators DELETE]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
