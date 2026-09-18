import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public, unauthenticated — landing page visitors who aren't ready to sign
// up yet. Writes to newsletter_subscribers only, never profiles/auth.users.
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(`newsletter:${ip}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const body = await req.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("newsletter_subscribers")
      .insert({ email, source: "landing_page" });

    // Unique violation — already subscribed. Don't reveal that; just succeed.
    if (error && error.code !== "23505") {
      console.error("[newsletter]", error.message);
      return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[newsletter]", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
