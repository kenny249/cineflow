import { NextResponse } from "next/server";
import { requireAdminPage } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminPage();
    const token = process.env.BRIEF_SHARE_TOKEN;
    if (!token) return NextResponse.json({ token: null });
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
