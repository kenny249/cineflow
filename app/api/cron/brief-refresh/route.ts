import { NextResponse } from "next/server";
import { runBriefVerification } from "@/lib/brief-verify";

// 8 items, each needing its own web search + a careful pick between conflicting
// sources, comfortably exceeds a 60-120s ceiling — this genuinely takes a while.
export const maxDuration = 280;

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
