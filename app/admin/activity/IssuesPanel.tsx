"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Link2, Mail, CreditCard, ServerCrash } from "lucide-react";
import { cn } from "@/lib/utils";

interface Issue {
  id: string;
  kind: "public_page_error" | "email_failed" | "payment_error" | "server_error" | "other";
  severity: "error" | "warning";
  message: string;
  context: Record<string, unknown>;
  created_at: string;
}

const KIND_META: Record<string, { icon: React.ElementType; label: string }> = {
  public_page_error: { icon: Link2, label: "Client-facing" },
  email_failed:      { icon: Mail, label: "Email" },
  payment_error:     { icon: CreditCard, label: "Payment" },
  server_error:      { icon: ServerCrash, label: "Server" },
  other:             { icon: AlertTriangle, label: "Issue" },
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function IssuesPanel() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/issues");
      if (res.ok) { const d = await res.json(); setIssues(d.issues ?? []); }
    } catch { /* ignore */ } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // refresh alongside the activity feed
    return () => clearInterval(t);
  }, [load]);

  async function resolve(id: string) {
    setIssues((prev) => prev.filter((i) => i.id !== id));
    try { await fetch("/api/admin/issues", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); } catch { load(); }
  }
  async function resolveAll() {
    setIssues([]);
    try { await fetch("/api/admin/issues", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolveAll: true }) }); } catch { load(); }
  }

  // Nothing to show when there are no open issues — stay out of the way.
  if (!loaded || issues.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-red-500/25 bg-red-500/[0.04] overflow-hidden">
      <div className="flex items-center justify-between border-b border-red-500/15 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold text-red-400">Needs attention · {issues.length} open issue{issues.length !== 1 ? "s" : ""}</span>
        </div>
        <button onClick={resolveAll} className="text-[11px] text-red-400/70 hover:text-red-400 transition-colors">Resolve all</button>
      </div>
      <div className="divide-y divide-red-500/10">
        {issues.map((iss) => {
          const meta = KIND_META[iss.kind] ?? KIND_META.other;
          const Icon = meta.icon;
          const ctxBits = [iss.context?.invoice, iss.context?.client_email, iss.context?.tokenHint && `token ${iss.context.tokenHint}…`, iss.context?.status && `HTTP ${iss.context.status}`, iss.context?.detail]
            .filter(Boolean).map(String);
          return (
            <div key={iss.id} className="group flex items-start gap-3 px-4 py-2.5 hover:bg-red-500/[0.03]">
              <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", iss.severity === "warning" ? "bg-amber-400/10" : "bg-red-400/10")}>
                <Icon className={cn("h-3.5 w-3.5", iss.severity === "warning" ? "text-amber-400" : "text-red-400")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-200">{iss.message}</p>
                {ctxBits.length > 0 && <p className="mt-0.5 truncate text-[11px] text-zinc-500">{ctxBits.join(" · ")}</p>}
                <p className="mt-0.5 text-[10px] text-zinc-600">{meta.label} · {timeAgo(iss.created_at)}</p>
              </div>
              <button onClick={() => resolve(iss.id)} title="Mark resolved" className="shrink-0 rounded-md p-1.5 text-zinc-500 opacity-0 transition-all hover:bg-emerald-500/10 hover:text-emerald-400 group-hover:opacity-100">
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
