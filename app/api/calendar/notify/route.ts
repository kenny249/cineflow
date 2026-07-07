import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const TYPE_COLOR: Record<string, string> = {
  shoot:     "#d4a853",
  meeting:   "#3b82f6",
  deadline:  "#ef4444",
  milestone: "#a855f7",
  delivery:  "#10b981",
  other:     "#71717a",
};

const TYPE_LABEL: Record<string, string> = {
  shoot: "Shoot Day", meeting: "Meeting", deadline: "Deadline",
  milestone: "Milestone", delivery: "Delivery", other: "Event",
};

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function buildICS(ev: {
  id: string; title: string; description?: string | null;
  location?: string | null; meeting_link?: string | null;
  start_time: string; end_time?: string | null;
}): string {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const dt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const now = dt(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CineFlow//EN",
    "CALSCALE:GREGORIAN", "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${ev.id}@cineflow`,
    `DTSTAMP:${now}`,
    `DTSTART:${dt(ev.start_time)}`,
    `DTEND:${dt(ev.end_time ?? ev.start_time)}`,
    `SUMMARY:${esc(ev.title)}`,
  ];
  let desc = ev.description ?? "";
  if (ev.meeting_link?.startsWith("http")) {
    desc = desc ? `${desc}\n\nJoin: ${ev.meeting_link}` : `Join: ${ev.meeting_link}`;
  }
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
  if (ev.meeting_link?.startsWith("http")) lines.push(`URL:${ev.meeting_link}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function buildEmailHtml(ev: {
  title: string; event_type: string; start_time: string; end_time?: string | null;
  location?: string | null; meeting_link?: string | null; description?: string | null;
}, agencyName: string, isReminder = false, clientName?: string): string {
  const color = TYPE_COLOR[ev.event_type] ?? TYPE_COLOR.other;
  const label = TYPE_LABEL[ev.event_type] ?? "Event";
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();
  const greeting = clientName ? `Hi ${clientName.split(" ")[0]},` : "Hi,";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#18181b;padding:32px 40px;">
      <div style="display:inline-block;background:${color}20;border:1px solid ${color}50;border-radius:999px;padding:4px 14px;margin-bottom:12px;">
        <span style="color:${color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${label}</span>
      </div>
      <p style="margin:0 0 6px;color:#a1a1aa;font-size:13px;">${greeting}</p>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;line-height:1.3;">${ev.title}</h1>
      ${isReminder ? `<p style="margin:8px 0 0;color:#d4a853;font-size:13px;font-weight:600;">Tomorrow — don't forget</p>` : `<p style="margin:8px 0 0;color:#a1a1aa;font-size:13px;">${agencyName} has scheduled an event with you.</p>`}
    </div>

    <!-- Details -->
    <div style="padding:28px 40px;border-bottom:1px solid #f4f4f5;">
      <!-- Date/time -->
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
        <div style="width:36px;height:36px;background:#f4f4f5;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;">📅</div>
        <div>
          <p style="margin:0;font-size:15px;font-weight:600;color:#18181b;">${formatEventDate(ev.start_time)}</p>
          <p style="margin:2px 0 0;font-size:13px;color:#71717a;">
            ${formatEventTime(ev.start_time)}${ev.end_time ? ` — ${formatEventTime(ev.end_time)}` : ""}
          </p>
        </div>
      </div>

      ${ev.location ? `
      <!-- Location -->
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
        <div style="width:36px;height:36px;background:#f4f4f5;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;">📍</div>
        <div>
          <p style="margin:0;font-size:15px;font-weight:600;color:#18181b;">${ev.location}</p>
        </div>
      </div>` : ""}

      ${ev.description ? `
      <!-- Notes -->
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="width:36px;height:36px;background:#f4f4f5;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;">📝</div>
        <p style="margin:0;font-size:14px;color:#52525b;line-height:1.6;white-space:pre-wrap;">${ev.description}</p>
      </div>` : ""}
    </div>

    <!-- CTAs -->
    <div style="padding:28px 40px;text-align:center;">
      ${ev.meeting_link?.startsWith("http") ? `
      <a href="${ev.meeting_link}" style="display:inline-block;background:${color};color:${ev.event_type === "shoot" ? "#000" : "#fff"};text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:700;margin-bottom:12px;">
        Join Call →
      </a>
      <br>` : ""}
      <p style="margin:${ev.meeting_link?.startsWith("http") ? "8" : "0"}px 0 0;font-size:13px;color:#71717a;">
        📎 A calendar invite is attached — open it to add this event to your calendar.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:16px 40px;border-top:1px solid #f4f4f5;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;">
        Sent by <strong>${agencyName}</strong> via <a href="${appUrl}" style="color:#a1a1aa;">CineFlow</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { eventId, isReminder = false, recipientEmail, recipientName } = await req.json();
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get event
    const { data: ev } = await service
      .from("calendar_events")
      .select("id, title, description, location, meeting_link, start_time, end_time, event_type, assigned_to, created_by, project_id")
      .eq("id", eventId)
      .single();
    if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // Get agency name from the owner's profile
    const { data: ownerProfile } = await service
      .from("profiles")
      .select("business_name, company, full_name")
      .eq("id", user.id)
      .single();

    const agencyName = ownerProfile?.business_name || ownerProfile?.company || ownerProfile?.full_name || "Your agency";

    // Recipient: explicit override (retainer flow) OR project client email
    let recipientEmails: string[];
    let clientName: string | undefined;

    if (recipientEmail) {
      recipientEmails = [recipientEmail];
      clientName = recipientName || undefined;
    } else {
      if (!ev.project_id) {
        return NextResponse.json({ sent: 0, message: "No project linked — no client to notify" });
      }
      const { data: project } = await service
        .from("projects")
        .select("client_name, client_email")
        .eq("id", ev.project_id)
        .single();
      if (!project?.client_email) {
        return NextResponse.json({ sent: 0, message: "Project has no client email" });
      }
      recipientEmails = [project.client_email];
      clientName = project.client_name || undefined;
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

    // Extract bare email in case RESEND_FROM_EMAIL is "Name <email@domain.com>"
    const fromEnv = process.env.RESEND_FROM_EMAIL ?? "noreply@usecineflow.com";
    const fromEmail = fromEnv.match(/<([^>]+)>/)?.[1] ?? fromEnv;
    const resend = new Resend(resendKey);

    const subject = isReminder
      ? `Reminder: ${ev.title} is tomorrow`
      : `Booking confirmed: ${ev.title} — ${formatEventDate(ev.start_time)}`;

    const icsContent = buildICS(ev);
    const html = buildEmailHtml(ev, agencyName, isReminder, clientName);

    const results = await Promise.allSettled(
      recipientEmails.map((to) =>
        resend.emails.send({
          from: `${agencyName} <${fromEmail}>`,
          to: [to],
          subject,
          html,
          attachments: [{
            filename: `${ev.title.replace(/[^a-z0-9]/gi, "_")}.ics`,
            content: Buffer.from(icsContent).toString("base64"),
          }],
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled" && !(r as any).value?.error).length;
    if (sent < results.length) {
      const errs = results
        .filter((r) => r.status === "rejected" || !!(r as any).value?.error)
        .map((r) => r.status === "rejected" ? String(r.reason) : (r as any).value?.error?.message)
        .join(", ");
      console.error("[calendar/notify] Resend errors:", errs);
    }
    return NextResponse.json({ sent, total: recipientEmails.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to send notifications";
    console.error("[calendar/notify]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
