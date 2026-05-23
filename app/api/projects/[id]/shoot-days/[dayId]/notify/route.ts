import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

type Params = { params: Promise<{ id: string; dayId: string }> };

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@usecineflow.com";

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: projectId, dayId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!resend) return NextResponse.json({ skipped: true, reason: "no RESEND_API_KEY" });

    const body = await req.json() as { changes: string; projectTitle: string; dayNumber: number; date?: string; generalCall?: string; location?: string };

    // Fetch active collaborators via admin
    const admin = createAdminClient();
    const { data: collabs } = await admin
      .from("project_collaborators")
      .select("id, name, email, user_id")
      .eq("project_id", projectId)
      .eq("status", "active");

    if (!collabs || collabs.length === 0) return NextResponse.json({ sent: 0 });

    const dateStr = body.date
      ? new Date(body.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : null;

    const detailLines = [
      dateStr && `<tr><td style="color:#a1a1aa;padding:3px 16px 3px 0;white-space:nowrap;">Date</td><td style="color:#fff;font-weight:600;">${dateStr}</td></tr>`,
      body.generalCall && `<tr><td style="color:#a1a1aa;padding:3px 16px 3px 0;white-space:nowrap;">General Call</td><td style="color:#d4a853;font-weight:700;font-size:15px;">${body.generalCall}</td></tr>`,
      body.location && `<tr><td style="color:#a1a1aa;padding:3px 16px 3px 0;white-space:nowrap;">Location</td><td style="color:#fff;font-weight:600;">${body.location}</td></tr>`,
    ].filter(Boolean).join("");

    let sent = 0;
    await Promise.all(
      collabs.map(async (c) => {
        const email = c.email?.trim().toLowerCase();
        if (!email || !c.user_id) return;
        const firstName = c.name.split(" ")[0] || c.name;
        await resend!.emails.send({
          from: FROM,
          to: email,
          subject: `Schedule update: ${body.projectTitle} — Day ${body.dayNumber}`,
          html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Schedule Update</title></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:12px;border:1px solid #27272a;overflow:hidden;max-width:560px;width:100%;">
<tr><td style="background:#18181b;padding:20px 40px;border-bottom:1px solid #27272a;">
  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#d4a853;">CineFlow · Schedule Update</p>
  <h1 style="margin:6px 0 0;font-size:20px;font-weight:800;color:#fff;">${body.projectTitle} — Day ${body.dayNumber}</h1>
</td></tr>
<tr><td style="padding:28px 40px;">
  <p style="margin:0 0 20px;font-size:15px;color:#a1a1aa;">Hey ${firstName} — the schedule for Day ${body.dayNumber} has been updated. Here's what you need to know:</p>
  <table style="font-size:14px;border-collapse:collapse;width:100%;">${detailLines}</table>
  <p style="margin:24px 0 0;font-size:13px;color:#71717a;">Log in to CineFlow to see the full schedule and your individual call time.</p>
</td></tr>
<tr><td style="padding:16px 40px;border-top:1px solid #27272a;text-align:center;">
  <p style="margin:0;font-size:11px;color:#52525b;">CineFlow · Production Management for Media Teams</p>
</td></tr>
</table></td></tr></table></body></html>`,
        });
        sent++;
      })
    );

    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[shoot-day notify]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
