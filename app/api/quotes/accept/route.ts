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
    const body = await req.json();
    const { token, name, email, selectedPackageId, declined } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: quote } = await supabase
      .from("quotes")
      .select("id, status")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (["accepted", "declined"].includes(quote.status)) {
      return NextResponse.json({ ok: true, already: true });
    }

    if (declined) {
      await supabase
        .from("quotes")
        .update({
          status: "declined",
          declined_at: new Date().toISOString(),
        })
        .eq("id", quote.id);
      return NextResponse.json({ ok: true, status: "declined" });
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    await supabase
      .from("quotes")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_name: name.trim(),
        accepted_email: email?.trim() ?? null,
      })
      .eq("id", quote.id);

    return NextResponse.json({ ok: true, status: "accepted" });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
