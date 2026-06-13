import { createClient } from "@/lib/supabase/client";

export type CardType = "note" | "script" | "shot" | "image" | "video" | "checklist" | "link";

export interface BoardCard {
  id: string;
  board_id: string;
  column_id: string | null;
  type: CardType;
  content: Record<string, unknown>;
  position: number;
  color?: string | null;
  x: number;
  y: number;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export type BoardWithCards = Board & { cards: BoardCard[] };

// Kept for backward compat with BoardColumn.tsx (no longer used in main flow)
export interface BoardColumn {
  id: string;
  board_id: string;
  title: string;
  position: number;
  cards: BoardCard[];
}

function db() {
  return createClient();
}

// ── Board CRUD ─────────────────────────────────────────────────────────────────

export async function getBoard(boardId: string): Promise<BoardWithCards | null> {
  const supabase = db();
  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .maybeSingle();

  if (!board) return null;

  const { data: cards } = await supabase
    .from("board_cards")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at");

  return { ...board, cards: (cards ?? []) as BoardCard[] };
}

export async function getBoardByProject(projectId: string): Promise<BoardWithCards | null> {
  const supabase = db();
  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!board) return null;
  return getBoard(board.id);
}

export async function getPublicBoard(token: string): Promise<BoardWithCards | null> {
  const supabase = db();
  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();

  if (!board) return null;

  const { data: cards } = await supabase
    .from("board_cards")
    .select("*")
    .eq("board_id", board.id)
    .order("created_at");

  return { ...board, cards: (cards ?? []) as BoardCard[] };
}

export async function getAllBoards(): Promise<Board[]> {
  const { data } = await db().from("boards").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Board[];
}

export async function createBoard(title: string, projectId?: string): Promise<Board> {
  const supabase = db();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data, error } = await supabase
    .from("boards")
    .insert({ title, workspace_id: user.id, project_id: projectId ?? null })
    .select()
    .single();

  if (error) throw error;
  return data as Board;
}

export async function updateBoardTitle(boardId: string, title: string): Promise<void> {
  await db().from("boards").update({ title, updated_at: new Date().toISOString() }).eq("id", boardId);
}

export async function deleteBoard(boardId: string): Promise<void> {
  await db().from("boards").delete().eq("id", boardId);
}

export async function generateShareToken(boardId: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "");
  await db().from("boards").update({ share_token: token }).eq("id", boardId);
  return token;
}

export async function revokeShareToken(boardId: string): Promise<void> {
  await db().from("boards").update({ share_token: null }).eq("id", boardId);
}

// ── Card CRUD ──────────────────────────────────────────────────────────────────

export async function createCard(
  boardId: string,
  type: CardType,
  content: Record<string, unknown>,
  x: number,
  y: number,
  columnId?: string | null
): Promise<BoardCard> {
  const { data, error } = await db()
    .from("board_cards")
    .insert({ board_id: boardId, column_id: columnId ?? null, type, content, position: 0, x, y })
    .select()
    .single();

  if (error) throw error;
  return data as BoardCard;
}

export async function updateCard(
  cardId: string,
  updates: Partial<Pick<BoardCard, "content" | "color" | "type">>
): Promise<void> {
  await db()
    .from("board_cards")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", cardId);
}

export async function updateCardPosition(cardId: string, x: number, y: number): Promise<void> {
  await db()
    .from("board_cards")
    .update({ x, y, updated_at: new Date().toISOString() })
    .eq("id", cardId);
}

export async function deleteCard(cardId: string): Promise<void> {
  await db().from("board_cards").delete().eq("id", cardId);
}

// ── Push card to production tools ─────────────────────────────────────────────

export async function pushShotToShotList(projectId: string, shotContent: Record<string, unknown>): Promise<void> {
  const supabase = db();

  const { data: existing } = await supabase
    .from("shot_lists")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  let shotListId = existing?.id;

  if (!shotListId) {
    const { data: newList, error } = await supabase
      .from("shot_lists")
      .insert({ project_id: projectId, title: "Shot List", date: new Date().toISOString().split("T")[0] })
      .select("id")
      .single();
    if (error) throw error;
    shotListId = newList.id;
  }

  const { data: items } = await supabase
    .from("shot_list_items")
    .select("sort_order")
    .eq("shot_list_id", shotListId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = ((items?.[0]?.sort_order as number) ?? 0) + 1;
  const scene = shotContent.scene_type ? `${shotContent.scene_type}. ${shotContent.location ?? ""} - ${shotContent.time ?? ""}`.trim() : "";
  const label = [scene, shotContent.notes].filter(Boolean).join(" — ") || "Shot from board";

  await supabase.from("shot_list_items").insert({
    shot_list_id: shotListId,
    label,
    done: false,
    sort_order: nextOrder,
  });
}

export async function pushScriptToNotes(projectId: string, scriptContent: Record<string, unknown>): Promise<void> {
  const supabase = db();
  await supabase.from("project_notes").insert({
    project_id: projectId,
    title: (scriptContent.title as string) || "Script from Board",
    body: (scriptContent.content as string) || "",
    pinned: false,
  });
}

// ── Column CRUD (kept for backward compat, not used in freeform view) ──────────

export async function createColumn(boardId: string, title: string, position: number): Promise<BoardColumn> {
  const { data, error } = await db()
    .from("board_columns")
    .insert({ board_id: boardId, title, position })
    .select()
    .single();

  if (error) throw error;
  return { ...data, cards: [] } as BoardColumn;
}

export async function updateColumnTitle(columnId: string, title: string): Promise<void> {
  await db().from("board_columns").update({ title }).eq("id", columnId);
}

export async function deleteColumn(columnId: string): Promise<void> {
  await db().from("board_columns").delete().eq("id", columnId);
}

export async function updateColumnPositions(updates: { id: string; position: number }[]): Promise<void> {
  await Promise.all(updates.map(({ id, position }) =>
    db().from("board_columns").update({ position }).eq("id", id)
  ));
}

export async function updateCardPositions(
  updates: { id: string; column_id: string; position: number }[]
): Promise<void> {
  await Promise.all(updates.map(({ id, column_id, position }) =>
    db().from("board_cards").update({ column_id, position }).eq("id", id)
  ));
}
