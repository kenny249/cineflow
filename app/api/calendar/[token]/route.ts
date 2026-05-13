import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyCalendarToken } from "@/lib/calendar-token";

function esc(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  // RFC 5545: fold lines at 75 octets
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

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("id, title, description, location, meeting_link, start_time, end_time, event_type")
    .eq("created_by", userId)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[calendar/feed] db error", error.message);
    return new NextResponse("Internal error", { status: 500 });
  }

  const now = dt(new Date().toISOString());

  const vevents = (events ?? []).map((ev) => {
    const endTime = ev.end_time ?? ev.start_time;
    const lines = [
      "BEGIN:VEVENT",
      `UID:${ev.id}@cineflow`,
      `DTSTAMP:${now}`,
      `DTSTART:${dt(ev.start_time)}`,
      `DTEND:${dt(endTime)}`,
      `SUMMARY:${esc(ev.title)}`,
    ];
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    if (ev.meeting_link) lines.push(`URL:${ev.meeting_link}`);
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

  console.log(`[calendar/feed] served ${(events ?? []).length} events for user ${userId.slice(0, 8)}…`);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
