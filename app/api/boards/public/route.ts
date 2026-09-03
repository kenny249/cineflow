import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public, token-gated endpoint for the read-only board share page. Runs
// with the service role and does the real token match itself — the RLS
// policy this used to rely on only checked "does this board have a share
// token at all," never that the caller's token actually matched it, which
// meant any shared board (and, via a share_token IS NOT NULL join, every
// one of its cards) was readable by anyone with the public anon key, no
// token required. Same fix shape as the quotes leak: move the real check
// here, server-side, and drop the public RLS policies entirely.
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const admin = getAdmin();
  const { data: board, error } = await admin
    .from("boards")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();

  if (error || !board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: cards } = await admin
    .from("board_cards")
    .select("*")
    .eq("board_id", board.id)
    .order("created_at");

  return NextResponse.json({ board: { ...board, cards: cards ?? [] } });
}
