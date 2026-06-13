"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus, Clock, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getAllBoards, createBoard } from "@/lib/boards";
import type { Board } from "@/lib/boards";
import { formatRelative } from "@/lib/utils";

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getAllBoards()
      .then(setBoards)
      .catch(() => toast.error("Failed to load boards"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const board = await createBoard("New Board");
      setBoards((prev) => [board, ...prev]);
    } catch {
      toast.error("Failed to create board");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-full p-5 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Boards</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Visual creative planning boards across all projects</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-xl bg-[#d4a853] px-3.5 py-2 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          New board
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      ) : boards.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
            <LayoutGrid className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No boards yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a board to start planning visually</p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 rounded-xl bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Create board
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              className="group rounded-2xl border border-border bg-card p-4 hover:border-[#d4a853]/40 hover:bg-card/80 transition-all"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background group-hover:border-[#d4a853]/30 transition-colors">
                <LayoutGrid className="h-4.5 w-4.5 text-muted-foreground/60 group-hover:text-[#d4a853]/70 transition-colors" />
              </div>
              <p className="font-medium text-sm text-foreground line-clamp-1 mb-1">{board.title}</p>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                <Clock className="h-3 w-3" />
                {formatRelative(board.updated_at)}
              </div>
              {board.share_token && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400/70">
                  <ExternalLink className="h-3 w-3" /> Shared publicly
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
