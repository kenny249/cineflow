"use client";

import { useEffect, useState } from "react";
import { Loader2, LayoutGrid } from "lucide-react";
import type { Board, BoardWithCards } from "@/lib/boards";
import { getBoardByProject, getBoard } from "@/lib/boards";
import { BoardView } from "@/components/boards/BoardView";
import { TemplatePicker } from "@/components/boards/TemplatePicker";

interface BoardTabProps {
  projectId: string;
}

export function BoardTab({ projectId }: BoardTabProps) {
  const [board, setBoard] = useState<BoardWithCards | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBoardByProject(projectId)
      .then((b) => { if (!cancelled) { setBoard(b); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  async function handleCreated(created: Board) {
    setShowPicker(false);
    const full = await getBoard(created.id);
    setBoard(full);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (!board) {
    return (
      <>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
            <LayoutGrid className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No board yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Create a visual planning board for this project</p>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors"
          >
            Create board
          </button>
        </div>

        {showPicker && (
          <TemplatePicker
            onClose={() => setShowPicker(false)}
            onCreated={handleCreated}
            projectId={projectId}
            defaultTitle="Project Board"
          />
        )}
      </>
    );
  }

  return (
    <div className="h-full">
      <BoardView board={board} projectId={projectId} />
    </div>
  );
}
