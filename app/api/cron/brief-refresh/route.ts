import { NextResponse } from "next/server";
import { runBriefVerification } from "@/lib/brief-verify";

// Live-tested: even with each item capped at a few searches and 3 rounds,
// one slow item (likely the two-company comparisons) blocked the whole
// parallel batch past both 90s and 150s with nothing to fall back on.
// lib/brief-verify.ts now hard-caps every item at 40s via Promise.race
// (verified locally: total batch time == the cap, not open-ended), so the
// route is genuinely bounded regardless of any single item's behavior.
export const maxDuration = 70;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBriefVerification();
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Verification failed" }, { status: 502 });
  }
  return NextResponse.json(result);
}
