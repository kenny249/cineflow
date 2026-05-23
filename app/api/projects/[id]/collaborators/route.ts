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

    const body = await req.json() as { email: string; name: string; permissions?: string[] };
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const VALID_PERMS = new Set(["mark_shots", "add_notes", "manage_tasks"]);
    const permissions = (body.permissions ?? []).filter((p) => VALID_PERMS.has(p));

    // Insert pending collaborator row
    const { data: collab, error: insertErr } = await supabase
      .from("project_collaborators")
      .insert({ project_id: projectId, invited_by: user.id, email, name, status: "pending", permissions })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: "This person has already been invited to this project" }, { status: 409 });
      }
      console.error("[collaborators POST] insert", insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const admin = createAdminClient();
    const origin = (req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();

    // Check if this email already has a CineFlow account
    const { data: { users: existingUsers } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = existingUsers.find((u) => u.email?.toLowerCase() === email);

    if (existingUser) {
      // Returning collaborator — activate the row directly and notify via Resend (not account creation email)
      const { error: activateErr } = await supabase
        .from("project_collaborators")
        .update({ user_id: existingUser.id, status: "active" })
        .eq("id", collab.id);

      if (activateErr) {
        console.error("[collaborators POST] activate existing", activateErr.message);
        await supabase.from("project_collaborators").delete().eq("id", collab.id);
        return NextResponse.json({ error: activateErr.message }, { status: 500 });
      }

      // Send "you've been added" notification via Resend (fire-and-forget)
      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@usecineflow.com";
        const collabBase = `${origin}/collab`;
        resend.emails.send({
          from: FROM,
          to: email,
          subject: `You've been added to ${project.title}`,
          html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>New Project</title></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:12px;border:1px solid #27272a;overflow:hidden;max-width:560px;width:100%;">
<tr><td style="background:#d4a853;padding:24px 40px;"><p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#000;opacity:0.6;">CineFlow</p><h1 style="margin:8px 0 0;font-size:22px;font-weight:800;color:#000;">New project: ${project.title}</h1></td></tr>
<tr><td style="padding:28px 40px;">
<p style="margin:0 0 16px;font-size:15px;color:#d4d4d8;line-height:1.6;">Hey ${name} — you've been added to <strong style="color:#fff;">${project.title}</strong>. Log in to view your tasks and collaborator tools.</p>
<a href="${collabBase}" style="display:inline-block;background:#d4a853;color:#000;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;">Open Project →</a>
</td></tr>
<tr><td style="padding:16px 40px;border-top:1px solid #27272a;text-align:center;"><p style="margin:0;font-size:11px;color:#52525b;">CineFlow · Production Management for Media Teams</p></td></tr>
</table></td></tr></table></body></html>`,
        }).catch(() => {});
      }

      return NextResponse.json({ ...collab, user_id: existingUser.id, status: "active" }, { status: 201 });
    }

    // New user — send standard Supabase invite email
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

// PATCH — update collaborator permissions
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { collaboratorId: string; permissions: string[] };
    if (!body.collaboratorId) return NextResponse.json({ error: "collaboratorId required" }, { status: 400 });

    const VALID_PERMS = new Set(["mark_shots", "add_notes", "manage_tasks"]);
    const permissions = (body.permissions ?? []).filter((p) => VALID_PERMS.has(p));

    const { error } = await supabase
      .from("project_collaborators")
      .update({ permissions })
      .eq("id", body.collaboratorId)
      .eq("project_id", projectId);

    if (error) {
      console.error("[collaborators PATCH]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, permissions });
  } catch (err) {
    console.error("[collaborators PATCH]", err);
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
