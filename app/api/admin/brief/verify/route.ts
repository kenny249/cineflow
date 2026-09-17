import { NextResponse } from "next/server";
import { requireAdminPage } from "@/lib/admin-guard";
import { runBriefVerification } from "@/lib/brief-verify";

export const dynamic = "force-dynamic";
// 8 items, each needing its own web search + a careful pick between conflicting
// sources, comfortably exceeds a 60-120s ceiling — this genuinely takes a while.
export const maxDuration = 280;

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
