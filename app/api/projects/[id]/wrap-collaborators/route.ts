import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

type Params = { params: Promise<{ id: string }> };

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@usecineflow.com";

function buildWrapEmail(collabName: string, projectTitle: string): string {
  const name = collabName.split(" ")[0] || collabName;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>That's a wrap!</title></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:12px;border:1px solid #27272a;overflow:hidden;max-width:560px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="background:#d4a853;padding:28px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#000;opacity:0.6;">CineFlow</p>
          <h1 style="margin:8px 0 0;font-size:26px;font-weight:800;color:#000;">That's a wrap! 🎬</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;color:#a1a1aa;">Hey ${name},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8;line-height:1.6;">
            Congratulations on completing <strong style="color:#ffffff;">${projectTitle}</strong>!
            It was a pleasure having you on the team — your work made it happen.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#d4d4d8;line-height:1.6;">
            Your project access has been closed out. If you're brought on to a future project,
            you'll receive a new invite and can jump right back in — no new account needed.
          </p>
          <p style="margin:0;font-size:14px;color:#71717a;">Until next time — keep creating.</p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="padding:20px 40px;border-top:1px solid #27272a;text-align:center;">
          <p style="margin:0;font-size:11px;color:#52525b;">CineFlow · Production Management for Media Teams</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// POST — called when a project is marked delivered; sends wrap emails to all newly-inactive collaborators
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: project } = await supabase
      .from("projects")
      .select("id, title")
      .eq("id", projectId)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (!resend) return NextResponse.json({ skipped: true, reason: "no RESEND_API_KEY" });

    // Fetch inactive collaborators who have a real email (were once active contributors)
    const { data: collabs } = await supabase
      .from("project_collaborators")
      .select("id, name, email, status")
      .eq("project_id", projectId)
      .eq("status", "inactive");

    if (!collabs || collabs.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const admin = createAdminClient();
    let sent = 0;

    await Promise.all(
      collabs.map(async (c) => {
        const email = c.email?.trim().toLowerCase();
        if (!email) return;

        // Confirm the user actually has an account (skip pure-pending-never-accepted)
        const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const hasAccount = users.some((u) => u.email?.toLowerCase() === email);
        if (!hasAccount) return;

        await resend!.emails.send({
          from: FROM,
          to: email,
          subject: `That's a wrap on ${project.title} 🎬`,
          html: buildWrapEmail(c.name, project.title),
        });
        sent++;
      })
    );

    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[wrap-collaborators POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
