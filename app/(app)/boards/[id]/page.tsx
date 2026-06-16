"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, Check, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { getBoard, updateBoardTitle } from "@/lib/boards";
import type { BoardWithCards } from "@/lib/boards";
import { getProject } from "@/lib/supabase/queries";
import type { Project } from "@/types";
import { BoardView } from "@/components/boards/BoardView";

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [board, setBoard] = useState<BoardWithCards | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  useEffect(() => {
    getBoard(id)
      .then(async (b) => {
        setBoard(b);
        setTitleInput(b?.title ?? "");
        if (b?.project_id) {
          try {
            const p = await getProject(b.project_id);
            setProject(p);
          } catch { /* non-fatal */ }
        }
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
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 shrink-0">
        <Link href="/boards" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {editingTitle ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleInput(board.title); } }}
              className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none border-b border-[#d4a853]/50"
              autoFocus
            />
            <button onClick={saveTitle} className="text-[#d4a853] shrink-0"><Check className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <h1 className="font-display text-sm font-semibold text-foreground truncate">{board.title}</h1>
            <button onClick={() => setEditingTitle(true)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0">
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}

        {board.project_id && (
          <Link
            href={`/projects/${board.project_id}?tab=board`}
            className="ml-auto flex items-center gap-1.5 shrink-0 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground/70 hover:border-[#d4a853]/40 hover:text-[#d4a853] transition-all"
          >
            <FolderOpen className="h-3 w-3" />
            {project ? project.title : "Project"}
          </Link>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <BoardView board={board} projectId={board.project_id ?? undefined} />
      </div>
    </div>
  );
}
