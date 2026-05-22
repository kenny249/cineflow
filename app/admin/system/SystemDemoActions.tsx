"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function SystemDemoActions({ expiredCount }: { expiredCount: number }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function purgeExpired() {
    if (!confirm(`Delete ${expiredCount} expired demo account(s)? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await fetch("/api/admin/system/purge-demos", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Purged ${json.deleted} expired demo accounts`);
        setDone(true);
      } else {
        toast.error("Purge failed");
      }
    });
  }

  if (done) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
      <Trash2 className="h-4 w-4 text-red-400 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-300">{expiredCount} expired demo accounts</p>
        <p className="text-xs text-red-400/60">These are more than 7 days old and should be cleaned up.</p>
      </div>
      <button
        onClick={purgeExpired}
        disabled={isPending}
        className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-60"
      >
        {isPending ? "Purging…" : "Purge expired"}
      </button>
    </div>
  );
}
