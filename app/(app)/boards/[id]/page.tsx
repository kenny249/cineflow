"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { getBoard, updateBoardTitle, deleteBoard } from "@/lib/boards";
import type { Board, BoardColumn } from "@/lib/boards";
import { BoardView } from "@/components/boards/BoardView";

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<(Board & { columns: BoardColumn[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  useEffect(() => {
    getBoard(id)
      .then((b) => {
        setBoard(b);
        setTitleInput(b?.title ?? "");
      })
      .catch(() => toast.error("Failed to load board"))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveTitle() {
    setEditingTitle(false);
    if (!board || titleInput.trim() === board.title) return;
    try {
      await updateBoardTitle(board.id, titleInput.trim() || "Board");
      setBoard((b) => b ? { ...b, title: titleInput.trim() || "Board" } : b);
    } catch {
      toast.error("Failed to rename board");
      setTitleInput(board.title);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Board not found.</p>
        <Link href="/boards" className="text-xs text-[#d4a853] hover:underline">Back to boards</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link href="/boards" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {editingTitle ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleInput(board.title); } }}
              className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none border-b border-[#d4a853]/50"
              autoFocus
            />
            <button onClick={saveTitle} className="text-[#d4a853]">
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <h1 className="font-display text-sm font-semibold text-foreground">{board.title}</h1>
            <button onClick={() => setEditingTitle(true)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        {board.project_id && (
          <Link href={`/projects/${board.project_id}?tab=board`} className="text-[11px] text-muted-foreground/50 hover:text-[#d4a853] transition-colors">
            View project →
          </Link>
        )}
      </div>

      {/* Board canvas */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <BoardView board={board} projectId={board.project_id ?? undefined} />
      </div>
    </div>
  );
}
