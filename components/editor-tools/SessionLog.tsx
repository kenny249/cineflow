"use client";

import { useState, useMemo } from "react";
import { format, startOfWeek, subDays, isAfter, startOfMonth } from "date-fns";
import { Trash2, Clock, TrendingUp, CalendarDays, Layers, Plus, X, Check } from "lucide-react";
import { deleteEditSession, createEditSession } from "@/lib/supabase/queries";
import type { EditSession, EditSessionCategory } from "@/types";
import { cn } from "@/lib/utils";

// ── Category config ───────────────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<EditSessionCategory, { label: string; color: string; bg: string; dot: string }> = {
  social:       { label: "Social",       color: "text-cyan-400",   bg: "bg-cyan-400/10",   dot: "bg-cyan-400"   },
  commercial:   { label: "Commercial",   color: "text-amber-400",  bg: "bg-amber-400/10",  dot: "bg-amber-400"  },
  narrative:    { label: "Narrative",    color: "text-violet-400", bg: "bg-violet-400/10", dot: "bg-violet-400" },
  documentary:  { label: "Documentary", color: "text-emerald-400", bg: "bg-emerald-400/10",dot: "bg-emerald-400"},
  corporate:    { label: "Corporate",   color: "text-blue-400",   bg: "bg-blue-400/10",   dot: "bg-blue-400"   },
  other:        { label: "Other",       color: "text-zinc-400",   bg: "bg-zinc-400/10",   dot: "bg-zinc-400"   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtHours(secs: number): string {
  const h = secs / 3600;
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(secs / 60)}m`;
}

// ── Week bar chart ────────────────────────────────────────────────────────────

function WeekBars({ sessions }: { sessions: EditSession[] }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    const key = format(d, "yyyy-MM-dd");
    const daySecs = sessions
      .filter((s) => s.created_at.startsWith(key))
      .reduce((sum, s) => sum + s.duration_secs, 0);
    return { label: format(d, "EEE"), key, secs: daySecs, isToday: i === 6 };
  });

  const maxSecs = Math.max(...days.map((d) => d.secs), 1);

  return (
    <div className="flex items-end gap-1.5 h-16">
      {days.map((d) => (
        <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
          <div className="relative w-full flex items-end" style={{ height: 44 }}>
            <div
              className={cn(
                "w-full rounded-t-sm transition-all duration-500",
                d.secs > 0
                  ? d.isToday ? "bg-[#d4a853]" : "bg-[#d4a853]/40"
                  : "bg-border/40"
              )}
              style={{ height: d.secs > 0 ? `${Math.max(4, (d.secs / maxSecs) * 44)}px` : "3px" }}
            />
          </div>
          <span className={cn("text-[9px] font-medium", d.isToday ? "text-[#d4a853]" : "text-muted-foreground/50")}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Category ring ─────────────────────────────────────────────────────────────

function CategoryRing({ sessions }: { sessions: EditSession[] }) {
  const totals = useMemo(() => {
    const map: Partial<Record<EditSessionCategory, number>> = {};
    for (const s of sessions) {
      map[s.category] = (map[s.category] ?? 0) + s.duration_secs;
    }
    return map;
  }, [sessions]);

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  if (total === 0) return (
    <div className="flex items-center justify-center h-24 w-24 rounded-full border-2 border-border/40">
      <span className="text-[10px] text-muted-foreground/40">No data</span>
    </div>
  );

  const COLORS: Record<EditSessionCategory, string> = {
    social: "#22d3ee", commercial: "#fbbf24", narrative: "#a78bfa",
    documentary: "#34d399", corporate: "#60a5fa", other: "#71717a",
  };

  const r = 36, cx = 44, cy = 44, circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = (Object.entries(totals) as [EditSessionCategory, number][])
    .filter(([, v]) => v > 0)
    .map(([cat, secs]) => {
      const pct = secs / total;
      const dash = pct * circumference;
      const slice = { cat, pct, dash, offset };
      offset += dash;
      return slice;
    });

  return (
    <div className="relative flex items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        {slices.map(({ cat, dash, offset: off }) => (
          <circle key={cat} cx={cx} cy={cy} r={r} fill="none"
            stroke={COLORS[cat]} strokeWidth="10"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={circumference / 4 - off}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute text-center">
        <p className="text-[10px] font-bold text-foreground leading-none">{fmtHours(total)}</p>
        <p className="text-[8px] text-muted-foreground/50 mt-0.5">total</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SessionLogProps {
  sessions: EditSession[];
  onDelete: (id: string) => void;
  onAdd: (session: EditSession) => void;
}

export function SessionLog({ sessions, onDelete, onAdd }: SessionLogProps) {
  const [filter, setFilter] = useState<"week" | "month" | "all">("week");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formHours, setFormHours] = useState("0");
  const [formMins, setFormMins] = useState("30");
  const [formCategory, setFormCategory] = useState<EditSessionCategory>("social");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const filtered = useMemo(() => {
    if (filter === "week") {
      const cutoff = startOfWeek(now, { weekStartsOn: 1 });
      return sessions.filter((s) => isAfter(new Date(s.created_at), cutoff));
    }
    if (filter === "month") {
      const cutoff = startOfMonth(now);
      return sessions.filter((s) => isAfter(new Date(s.created_at), cutoff));
    }
    return sessions;
  }, [sessions, filter]);

  const totalSecs  = filtered.reduce((s, e) => s + e.duration_secs, 0);
  const avgSecs    = filtered.length ? Math.round(totalSecs / filtered.length) : 0;
  const longestSec = filtered.reduce((max, s) => Math.max(max, s.duration_secs), 0);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteEditSession(id);
      onDelete(id);
    } catch { /* best-effort */ }
    setDeletingId(null);
  }

  async function handleSave() {
    const title = formTitle.trim();
    if (!title) return;
    const h = parseInt(formHours, 10) || 0;
    const m = parseInt(formMins, 10) || 0;
    const secs = h * 3600 + m * 60;
    if (secs <= 0) return;
    setSaving(true);
    try {
      const session = await createEditSession({ title, category: formCategory, duration_secs: secs, notes: formNote.trim() || undefined });
      onAdd(session);
      setShowForm(false);
      setFormTitle(""); setFormHours("0"); setFormMins("30"); setFormNote(""); setFormCategory("social");
    } catch { /* best-effort */ }
    setSaving(false);
  }

  // Category breakdown for filtered sessions
  const catTotals = useMemo(() => {
    const map: Partial<Record<EditSessionCategory, number>> = {};
    for (const s of filtered) map[s.category] = (map[s.category] ?? 0) + s.duration_secs;
    return Object.entries(map).sort(([, a], [, b]) => b - a) as [EditSessionCategory, number][];
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6">

      {/* Top row: filter + log button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-muted/30 w-fit">
          {(["week", "month", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "week" ? "This Week" : f === "month" ? "This Month" : "All Time"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-xl bg-[#d4a853] px-3.5 py-2 text-xs font-semibold text-black hover:bg-[#c49843] active:scale-95 transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> Log Session
        </button>
      </div>

      {/* Manual log form */}
      {showForm && (
        <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Log a Session</p>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">What did you work on?</label>
            <input
              type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Brand film rough cut, TikTok edit, Client revisions…"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 focus:border-[#d4a853]/40 transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 w-24">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Hours</label>
              <input type="number" min="0" max="23" value={formHours} onChange={(e) => setFormHours(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground text-center font-mono focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 focus:border-[#d4a853]/40 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-24">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Minutes</label>
              <input type="number" min="0" max="59" value={formMins} onChange={(e) => setFormMins(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground text-center font-mono focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 focus:border-[#d4a853]/40 transition-colors"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Type of edit</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(CATEGORY_CONFIG) as [EditSessionCategory, typeof CATEGORY_CONFIG[EditSessionCategory]][]).map(([cat, cfg]) => (
                <button key={cat} onClick={() => setFormCategory(cat)}
                  className={cn("px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                    formCategory === cat ? `${cfg.bg} ${cfg.color} border-current/30` : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  )}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Note (optional)</label>
            <input type="text" value={formNote} onChange={(e) => setFormNote(e.target.value)}
              placeholder="Any context you want to remember…"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 focus:border-[#d4a853]/40 transition-colors"
            />
          </div>
          <button onClick={handleSave} disabled={saving || !formTitle.trim() || (parseInt(formHours)||0) + (parseInt(formMins)||0) === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#d4a853] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-40 active:scale-95 transition-all w-fit"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save Session"}
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Clock,      label: "Total Time",      value: totalSecs > 0 ? fmtDuration(totalSecs) : "—" },
          { icon: Layers,     label: "Sessions",        value: filtered.length > 0 ? String(filtered.length) : "—" },
          { icon: TrendingUp, label: "Avg Session",     value: avgSecs > 0 ? fmtDuration(avgSecs) : "—" },
          { icon: CalendarDays,label: "Longest Session",value: longestSec > 0 ? fmtDuration(longestSec) : "—" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-3.5 w-3.5 text-[#d4a853]" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
            </div>
            <p className="text-xl font-bold text-foreground font-mono">{value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Week bars */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-4">Last 7 Days</p>
          <WeekBars sessions={sessions} />
        </div>

        {/* Category breakdown */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-4">By Category</p>
          {catTotals.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 text-center py-6">No sessions yet</p>
          ) : (
            <div className="flex items-center gap-6">
              <CategoryRing sessions={filtered} />
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {catTotals.map(([cat, secs]) => {
                  const cfg = CATEGORY_CONFIG[cat];
                  const pct = totalSecs > 0 ? Math.round((secs / totalSecs) * 100) : 0;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
                      <span className="text-[11px] text-muted-foreground flex-1 truncate">{cfg.label}</span>
                      <span className="text-[11px] font-mono text-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session history */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-foreground">Session History</p>
        </div>
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground/50">No sessions logged yet.</p>
            <p className="text-xs text-muted-foreground/30 mt-1">Start a focus session on the Tasks page to log time here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((s) => {
              const cfg = CATEGORY_CONFIG[s.category];
              return (
                <div key={s.id} className="flex items-start gap-3 px-4 py-3 group hover:bg-accent/20 transition-colors">
                  <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", cfg.bg)}>
                    <Clock className={cn("h-3.5 w-3.5", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{fmtDuration(s.duration_secs)}</span>
                      <span className="text-[10px] text-muted-foreground/40">
                        {format(new Date(s.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {s.notes && (
                      <p className="text-[11px] text-muted-foreground/60 mt-1 italic">"{s.notes}"</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deletingId === s.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-400 disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
