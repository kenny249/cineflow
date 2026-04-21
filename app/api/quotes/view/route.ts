import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Only update viewed_at if not already viewed/acted on
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, status, viewed_at")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!quote) return NextResponse.json({ ok: true }); // silent 200

    if (!quote.viewed_at && !["accepted", "declined"].includes(quote.status)) {
      await supabase
        .from("quotes")
        .update({ viewed_at: new Date().toISOString(), status: "viewed" })
        .eq("id", quote.id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
