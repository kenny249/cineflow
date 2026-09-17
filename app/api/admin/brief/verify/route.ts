import { NextResponse } from "next/server";
import { requireAdminPage } from "@/lib/admin-guard";
import { runBriefVerification } from "@/lib/brief-verify";

export const dynamic = "force-dynamic";
// Each of the 8 items now runs as its own small, bounded, parallel request
// (a few searches max) instead of one giant sequential request researching
// all of them — total wall time is bounded by the slowest single item.
export const maxDuration = 90;

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
