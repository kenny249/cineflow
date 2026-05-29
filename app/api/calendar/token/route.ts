import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCalendarToken } from "@/lib/calendar-token";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = generateCalendarToken(user.id);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();
  const url = `${base}/api/calendar/${token}`;

  return NextResponse.json({ url });
}
