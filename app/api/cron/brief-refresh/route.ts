import { NextResponse } from "next/server";
import { runBriefVerification } from "@/lib/brief-verify";

// Each of the 8 items now runs as its own small, bounded, parallel request
// (a few searches max) instead of one giant sequential request researching
// all of them — total wall time is bounded by the slowest single item.
export const maxDuration = 90;

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
