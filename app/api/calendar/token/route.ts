import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCalendarToken } from "@/lib/calendar-token";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = generateCalendarToken(user.id);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com";
  const url = `${base}/api/calendar/${token}`;

  console.log(`[calendar/token] generated feed URL for user ${user.id.slice(0, 8)}…`);
  return NextResponse.json({ url });
}
