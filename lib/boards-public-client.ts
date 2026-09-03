import type { BoardCard, CardType } from "@/lib/boards";

// Mirrors the shape of the authenticated card mutations in lib/boards.ts,
// but routes through the token-checked public API instead of the
// authenticated browser client — used when a board is opened via an
// "anyone with the link can edit" share link, where there's no logged-in
// user and therefore no RLS-based ownership to rely on at all.

async function call(method: string, body?: Record<string, unknown>, query?: string) {
  const url = `/api/boards/public/cards${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export function createPublicBoardActions(shareToken: string) {
  return {
    async createCard(
      _boardId: string,
      type: CardType,
      content: Record<string, unknown>,
      x: number,
      y: number
    ): Promise<BoardCard> {
      const { card } = await call("POST", { token: shareToken, type, content, x, y });
      return card as BoardCard;
    },

    async updateCard(
      cardId: string,
      updates: Partial<Pick<BoardCard, "content" | "color" | "type" | "width" | "height">>
    ): Promise<void> {
      await call("PATCH", { token: shareToken, cardId, updates });
    },

    async updateCardPosition(cardId: string, x: number, y: number): Promise<void> {
      await call("PATCH", { token: shareToken, cardId, updates: { x, y } });
    },

    async deleteCard(cardId: string): Promise<void> {
      await call("DELETE", undefined, `token=${encodeURIComponent(shareToken)}&cardId=${encodeURIComponent(cardId)}`);
    },
  };
}

export type BoardActions = ReturnType<typeof createPublicBoardActions>;
