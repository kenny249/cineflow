import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

// Public, token-gated card mutations for boards shared with "anyone with
// the link can edit." Runs with the service role and does every check
// itself — nothing here can be assumed safe just because it came through
// the app; the token is the only thing standing between "an editor of
// this board" and "anyone on the internet."
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getEditableBoard(admin: ReturnType<typeof getAdmin>, token: string) {
  const { data: board } = await admin
    .from("boards")
    .select("id, share_token, share_permission")
    .eq("share_token", token)
    .maybeSingle();
  if (!board || board.share_permission !== "edit") return null;
  return board;
}

const ALLOWED_UPDATE_FIELDS = ["content", "color", "type", "width", "height", "x", "y"] as const;

function sanitizeUpdates(updates: unknown): Record<string, unknown> {
  if (!updates || typeof updates !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (key in (updates as Record<string, unknown>)) out[key] = (updates as Record<string, unknown>)[key];
  }
  return out;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`boards-public-write:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { token, type, content, x, y } = body;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const admin = getAdmin();
  const board = await getEditableBoard(admin, token);
  if (!board) return NextResponse.json({ error: "Not found or not editable" }, { status: 403 });

  const { data: card, error } = await admin
    .from("board_cards")
    .insert({ board_id: board.id, type, content: content ?? {}, position: 0, x: x ?? 0, y: y ?? 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create card" }, { status: 500 });
  return NextResponse.json({ card });
}

export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`boards-public-write:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { token, cardId, updates } = body;
  if (!token || !cardId) return NextResponse.json({ error: "token and cardId required" }, { status: 400 });

  const admin = getAdmin();
  const board = await getEditableBoard(admin, token);
  if (!board) return NextResponse.json({ error: "Not found or not editable" }, { status: 403 });

  // The card has to actually belong to *this* board — an edit token for
  // board A must never be usable to touch board B's cards, even if its id
  // were guessed or leaked some other way.
  const { data: existing } = await admin.from("board_cards").select("id").eq("id", cardId).eq("board_id", board.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Card not found on this board" }, { status: 404 });

  const safeUpdates = sanitizeUpdates(updates);
  const { error } = await admin
    .from("board_cards")
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq("id", cardId);

  if (error) return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`boards-public-write:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get("token");
  const cardId = req.nextUrl.searchParams.get("cardId");
  if (!token || !cardId) return NextResponse.json({ error: "token and cardId required" }, { status: 400 });

  const admin = getAdmin();
  const board = await getEditableBoard(admin, token);
  if (!board) return NextResponse.json({ error: "Not found or not editable" }, { status: 403 });

  const { data: existing } = await admin.from("board_cards").select("id").eq("id", cardId).eq("board_id", board.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Card not found on this board" }, { status: 404 });

  const { error } = await admin.from("board_cards").delete().eq("id", cardId);
  if (error) return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
  return NextResponse.json({ success: true });
}
