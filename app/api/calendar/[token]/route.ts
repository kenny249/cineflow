import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyCalendarToken } from "@/lib/calendar-token";

function esc(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const limit = first ? 75 : 74;
    chunks.push((first ? "" : " ") + bytes.slice(offset, offset + limit).toString("utf8"));
    offset += limit;
    first = false;
  }
  return chunks.join("\r\n");
}

function dt(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const userId = verifyCalendarToken(token);

  if (!userId) {
    console.warn("[calendar/feed] invalid token");
    return new NextResponse("Invalid token", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find workspace owner so we can pull all workspace events
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", userId)
    .single();

  const workspaceOwnerId = profile?.workspace_id ?? userId;

  // All profiles in this workspace (owner + team members)
  const { data: members } = await supabase
    .from("profiles")
    .select("id")
    .eq("workspace_id", workspaceOwnerId);

  const memberIds = (members ?? []).map((m: any) => m.id);
  if (!memberIds.includes(workspaceOwnerId)) memberIds.push(workspaceOwnerId);

  // Events: workspace-wide (no assigned_to) OR assigned specifically to this user
  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("id, title, description, location, meeting_link, start_time, end_time, event_type, assigned_to")
    .in("created_by", memberIds.length > 0 ? memberIds : [userId])
    .or(`assigned_to.is.null,assigned_to.eq.${userId}`)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[calendar/feed] db error", error.message);
    return new NextResponse("Internal error", { status: 500 });
  }

  const now = dt(new Date().toISOString());

  const vevents = (events ?? []).map((ev) => {
    const endTime = ev.end_time ?? ev.start_time;

    // Build description — include meeting link if present
    let desc = ev.description ?? "";
    if (ev.meeting_link?.startsWith("http")) {
      desc = desc ? `${desc}\n\nJoin: ${ev.meeting_link}` : `Join: ${ev.meeting_link}`;
    }

    const lines = [
      "BEGIN:VEVENT",
      `UID:${ev.id}@cineflow`,
      `DTSTAMP:${now}`,
      `DTSTART:${dt(ev.start_time)}`,
      `DTEND:${dt(endTime)}`,
      `SUMMARY:${esc(ev.title)}`,
    ];
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    if (ev.meeting_link?.startsWith("http")) lines.push(`URL:${ev.meeting_link}`);
    lines.push("END:VEVENT");
    return lines.map(foldLine).join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cineflow//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Cineflow",
    "X-WR-CALDESC:Your Cineflow production calendar",
    "X-WR-TIMEZONE:UTC",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
