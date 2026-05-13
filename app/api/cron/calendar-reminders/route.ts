import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find events starting tomorrow (UTC)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayStart = new Date(tomorrow);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(tomorrow);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const { data: events, error } = await service
    .from("calendar_events")
    .select("id, title, start_time")
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString());

  if (error) {
    console.error("[cron/calendar-reminders] db error", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!events || events.length === 0) {
    console.log("[cron/calendar-reminders] no events tomorrow");
    return NextResponse.json({ sent: 0 });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();
  let totalSent = 0;

  for (const ev of events) {
    try {
      const res = await fetch(`${base}/api/calendar/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: ev.id, isReminder: true }),
      });
      const data = await res.json();
      if (typeof data.sent === "number") totalSent += data.sent;
    } catch (e) {
      console.error(`[cron/calendar-reminders] failed for event ${ev.id}`, e);
    }
  }

  console.log(`[cron/calendar-reminders] sent ${totalSent} reminders for ${events.length} events`);
  return NextResponse.json({ events: events.length, sent: totalSent });
}
