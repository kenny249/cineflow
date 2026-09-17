import { NextResponse } from "next/server";
import { requireAdminPage } from "@/lib/admin-guard";
import { runBriefVerification } from "@/lib/brief-verify";

export const dynamic = "force-dynamic";
// Each of the 8 items runs as its own small, bounded, parallel request (a few
// searches max each) rather than one giant sequential request researching all
// of them. Measured 13s for 2 items run locally, but 8 concurrent requests
// from the same API key can hit real contention/backoff in production that
// doesn't show up at small scale — 90s wasn't enough margin, even though each
// item is individually bounded. 150s gives real headroom without going back
// to the old design's unbounded risk.
export const maxDuration = 150;

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
