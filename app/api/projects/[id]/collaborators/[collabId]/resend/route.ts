import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string; collabId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: projectId, collabId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: project } = await supabase
      .from("projects")
      .select("id, title")
      .eq("id", projectId)
      .single();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const admin = createAdminClient();
    const { data: collab } = await admin
      .from("project_collaborators")
      .select("id, email, name, status")
      .eq("id", collabId)
      .eq("project_id", projectId)
      .single();

    if (!collab) return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
    if (collab.status !== "pending") return NextResponse.json({ error: "Invite is not pending" }, { status: 400 });

    const origin = (req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
    const email = collab.email.toLowerCase();

    // Check if they already have an account
    const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = users.find((u) => u.email?.toLowerCase() === email);

    if (existingUser) {
      // Activate them directly and send a notification
      await admin
        .from("project_collaborators")
        .update({ user_id: existingUser.id, status: "active" })
        .eq("id", collabId);

      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@usecineflow.com";
        resend.emails.send({
          from: FROM,
          to: email,
          subject: `You've been added to ${project.title}`,
          html: `<p>Hey ${collab.name.split(" ")[0]} — you've been added to <strong>${project.title}</strong> on CineFlow. <a href="${origin}/collab">Open your projects →</a></p>`,
        }).catch(() => {});
      }
      return NextResponse.json({ resent: true, activated: true });
    }

    // New user — resend the Supabase invite email (generates a fresh invite link)
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?type=collab_invite&project_id=${projectId}&next=/collab`,
      data: {
        is_collaborator: true,
        project_id: projectId,
        project_title: project.title,
        invited_as: collab.name,
        invited_by_id: user.id,
      },
    });

    if (inviteErr) {
      console.error("[resend invite]", inviteErr.message);
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }

    return NextResponse.json({ resent: true });
  } catch (err) {
    console.error("[resend invite]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
