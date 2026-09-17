import { NextResponse } from "next/server";
import { requireAdminPage } from "@/lib/admin-guard";
import { runBriefVerification } from "@/lib/brief-verify";

export const dynamic = "force-dynamic";
// Live-tested: even with each item capped at a few searches and 3 rounds,
// one slow item (likely the two-company comparisons) blocked the whole
// parallel batch past both 90s and 150s with nothing to fall back on.
// lib/brief-verify.ts now hard-caps every item at 40s via Promise.race
// (verified locally: total batch time == the cap, not open-ended), so the
// route is genuinely bounded regardless of any single item's behavior.
export const maxDuration = 70;

export async function POST() {
  try {
    await requireAdminPage();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runBriefVerification();
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Verification failed" }, { status: 502 });
  }
  return NextResponse.json(result);
}
