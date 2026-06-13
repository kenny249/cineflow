"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, LayoutGrid, Lock } from "lucide-react";
import { getPublicBoard } from "@/lib/boards";
import type { Board, BoardColumn } from "@/lib/boards";
import { BoardView } from "@/components/boards/BoardView";

export default function SharedBoardPage() {
  const { token } = useParams<{ token: string }>();
  const [board, setBoard] = useState<(Board & { columns: BoardColumn[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getPublicBoard(token)
      .then((b) => {
        if (!b) setNotFound(true);
        else setBoard(b);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (notFound || !board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
          <Lock className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Board not found</p>
          <p className="text-xs text-muted-foreground mt-1">This board may have been deleted or its share link revoked.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-[#d4a853]" />
          <span className="font-display text-sm font-semibold text-foreground">{board.title}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
          <Lock className="h-3 w-3" />
          Read-only view · Powered by CineFlow
        </div>
      </div>

      {/* Board (read-only) */}
      <div className="flex-1 overflow-hidden" style={{ height: "calc(100vh - 49px)" }}>
        <BoardView board={board} readonly />
      </div>
    </div>
  );
}
