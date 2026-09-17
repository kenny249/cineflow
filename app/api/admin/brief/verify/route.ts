import { NextResponse } from "next/server";
import { requireAdminPage } from "@/lib/admin-guard";
import { runBriefVerification } from "@/lib/brief-verify";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
