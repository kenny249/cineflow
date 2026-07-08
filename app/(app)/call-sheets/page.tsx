"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clipboard, Plus, Share2, Check, Calendar, ChevronRight, Loader2, Clock, Search, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface CallSheetRow {
  id: string;
  title: string;
  shoot_date: string | null;
  share_token: string | null;
  updated_at: string;
  project: { id: string; title: string } | null;
  crew_count?: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "No date set";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function ShareButton({ shareToken }: { shareToken: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!shareToken) { toast.error("No share link yet — open and save the call sheet first"); return; }
    const url = `${window.location.origin}/call-sheet/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied — share with your crew");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      title="Copy crew share link"
      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}

function CallSheetCard({ cs, onClick }: { cs: CallSheetRow; onClick: () => void }) {
  const isUpcoming = cs.shoot_date && daysUntil(cs.shoot_date) >= 0;
  const days = cs.shoot_date ? daysUntil(cs.shoot_date) : null;

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 hover:border-border/80 hover:bg-accent/20 cursor-pointer transition-all"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
        <Clipboard className="h-4.5 w-4.5 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{cs.title}</p>
          {days !== null && isUpcoming && days === 0 && (
            <span className="rounded-full bg-[#d4a853]/15 border border-[#d4a853]/30 px-2 py-0.5 text-[10px] font-bold text-[#d4a853] uppercase tracking-wide">Today</span>
          )}
          {days !== null && isUpcoming && days === 1 && (
            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wide">Tomorrow</span>
          )}
          {days !== null && isUpcoming && days > 1 && days <= 7 && (
            <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-semibold text-blue-400">{days}d away</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground/70">
          {cs.project && <span className="truncate">{cs.project.title}</span>}
          {cs.shoot_date && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span>{formatDate(cs.shoot_date)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <ShareButton shareToken={cs.share_token} />
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
      </div>
    </div>
  );
}

export default function CallSheetsPage() {
  const router = useRouter();
  const [sheets, setSheets] = useState<CallSheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("call_sheets")
        .select("id, title, shoot_date, share_token, updated_at, project:projects(id, title)")
        .order("shoot_date", { ascending: true, nullsFirst: false });

      if (error) { toast.error("Failed to load call sheets"); setLoading(false); return; }
      setSheets((data ?? []) as unknown as CallSheetRow[]);
      setLoading(false);
    }
    load();
  }, []);

  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of sheets) {
      if (s.project && !seen.has(s.project.id)) seen.set(s.project.id, s.project.title);
    }
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  }, [sheets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sheets.filter((s) => {
      if (projectFilter && s.project?.id !== projectFilter) return false;
      if (q) {
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchProject = s.project?.title.toLowerCase().includes(q) ?? false;
        if (!matchTitle && !matchProject) return false;
      }
      return true;
    });
  }, [sheets, search, projectFilter]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = filtered.filter((s) => {
    if (!s.shoot_date) return false;
    const d = new Date(s.shoot_date + "T00:00:00");
    return d >= today;
  });

  const past = filtered
    .filter((s) => {
      if (!s.shoot_date) return true;
      const d = new Date(s.shoot_date + "T00:00:00");
      return d < today;
    })
    .reverse();

  function openSheet(cs: CallSheetRow) {
    if (!cs.project) return;
    router.push(`/projects/${cs.project.id}?sheet=${cs.id}`);
  }

  function openNewSheet() {
    router.push("/projects");
    toast("Open a project and click Call Sheet to create one");
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Call Sheets</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All your call sheets across every project — sorted by shoot date.
            </p>
          </div>
          <button
            onClick={openNewSheet}
            className="flex items-center gap-2 rounded-xl bg-[#d4a853] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>

        {sheets.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search call sheets…"
                className="w-full rounded-xl border border-border bg-card pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {projects.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setProjectFilter(null)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${projectFilter === null ? "border-[#d4a853]/50 bg-[#d4a853]/10 text-[#d4a853]" : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"}`}
                >
                  All projects
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProjectFilter(projectFilter === p.id ? null : p.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${projectFilter === p.id ? "border-[#d4a853]/50 bg-[#d4a853]/10 text-[#d4a853]" : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"}`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {sheets.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-20 text-center px-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
              <Clipboard className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-foreground">No call sheets yet</p>
            <p className="mt-1.5 text-xs text-muted-foreground max-w-xs leading-relaxed">
              Open any project and click the Call Sheet button to build your first one. It auto-saves and shows up here.
            </p>
          </div>
        )}

        {sheets.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 py-16 text-center px-6">
            <p className="text-sm font-semibold text-foreground">No results</p>
            <p className="mt-1.5 text-xs text-muted-foreground">Try a different search or clear the project filter.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-[#d4a853]" />
              <p className="text-xs font-bold uppercase tracking-widest text-[#d4a853]">Upcoming</p>
              <span className="text-xs text-muted-foreground/50">{upcoming.length}</span>
            </div>
            <div className="space-y-2">
              {upcoming.map((cs) => (
                <CallSheetCard key={cs.id} cs={cs} onClick={() => openSheet(cs)} />
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Past Shoots</p>
              <span className="text-xs text-muted-foreground/40">{past.length}</span>
            </div>
            <div className="space-y-2">
              {past.map((cs) => (
                <CallSheetCard key={cs.id} cs={cs} onClick={() => openSheet(cs)} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
