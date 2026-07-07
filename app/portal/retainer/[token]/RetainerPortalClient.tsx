"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Film, Circle, Camera, CheckCircle2, CalendarDays, Repeat2, FolderOpen, Download, CheckCheck, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetainerTemplateItem, RetainerDeliverableStatus, RetainerMonthStatus } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShootDayEntry {
  id: string;
  date: string;
  location?: string;
  notes?: string;
}

interface PortalMonth {
  id: string;
  month_year: string;
  status: RetainerMonthStatus;
  shoot_date?: string;
  shoot_days?: ShootDayEntry[];
  notes?: string;
  client_notes?: string | null;
  delivery_url?: string | null;
  approved_at?: string | null;
}

interface PortalDeliverable {
  id: string;
  title: string;
  type: string;
  status: RetainerDeliverableStatus;
  sort_order: number;
  revision_count: number;
  revision_status: string;
}

interface PortalData {
  retainer: {
    client_name: string;
    monthly_rate?: number;
    template: RetainerTemplateItem[];
    is_active: boolean;
    delivery_folder_url?: string | null;
  };
  agencyName: string;
  activeMonth: PortalMonth | null;
  deliverables: PortalDeliverable[];
  allMonths: { id: string; month_year: string; status: RetainerMonthStatus; delivery_url?: string | null; approved_at?: string | null }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMonthYear(my: string) {
  const [y, m] = my.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

const DELIVERABLE_STATUS: Record<RetainerDeliverableStatus, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  planned:   { icon: <Circle className="h-4 w-4" />,       label: "Planned",   color: "text-white/20",    bg: "bg-white/5" },
  shot:      { icon: <Camera className="h-4 w-4" />,       label: "Shot",      color: "text-amber-400",   bg: "bg-amber-400/10" },
  delivered: { icon: <CheckCircle2 className="h-4 w-4" />, label: "Delivered", color: "text-emerald-400", bg: "bg-emerald-400/10" },
};

const MONTH_STATUS_LABEL: Record<RetainerMonthStatus, { label: string; color: string }> = {
  planning:  { label: "Planning",  color: "text-white/40" },
  active:    { label: "Active",    color: "text-emerald-400" },
  wrapped:   { label: "Wrapped",   color: "text-blue-400" },
  invoiced:  { label: "Invoiced",  color: "text-[#d4a853]" },
};

function ProgressBar({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-white/8 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-white/30 tabular-nums w-8 text-right">{done}/{total}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RetainerPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvedMonthId, setApprovedMonthId] = useState<string | null>(null);
  const [clientNotes, setClientNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/retainer-portal/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.error); return; }
        setData(json);
        if (json.activeMonth?.approved_at) setApprovedMonthId(json.activeMonth.id);
        if (json.activeMonth?.client_notes) setClientNotes(json.activeMonth.client_notes);
      })
      .catch(() => setError("Failed to load portal"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove(monthId: string) {
    setApproving(true);
    try {
      await fetch(`/api/retainer-portal/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthId }),
      });
      setApprovedMonthId(monthId);
    } catch { /* silent */ } finally {
      setApproving(false);
    }
  }

  const saveNotes = useCallback(async (monthId: string, notes: string) => {
    setSavingNotes(true);
    try {
      await fetch(`/api/retainer-portal/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthId, client_notes: notes }),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch { /* silent */ } finally {
      setSavingNotes(false);
    }
  }, [token]);

  function handleNotesChange(monthId: string, value: string) {
    setClientNotes(value);
    setNotesSaved(false);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => saveNotes(monthId, value), 1200);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0b]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d4a853] border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0b0b] px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/8">
          <Repeat2 className="h-5 w-5 text-[#d4a853]/50" />
        </div>
        <p className="text-sm text-white/40">This portal link is invalid or has been removed.</p>
      </div>
    );
  }

  const { retainer, agencyName, activeMonth, deliverables, allMonths } = data;

  const typeGroups = retainer.template.map((t) => {
    const items = deliverables.filter((d) => d.type === t.type);
    const delivered = items.filter((d) => d.status === "delivered").length;
    const shot = items.filter((d) => d.status === "shot").length;
    return { ...t, items, delivered, shot };
  });

  const totalDeliverables = deliverables.length;
  const totalDelivered = deliverables.filter((d) => d.status === "delivered").length;
  const totalShot = deliverables.filter((d) => d.status === "shot").length;
  const overallPct = totalDeliverables === 0 ? 0 : Math.round((totalDelivered / totalDeliverables) * 100);
  const monthStatusCfg = activeMonth ? MONTH_STATUS_LABEL[activeMonth.status] : null;
  const isApproved = activeMonth ? (approvedMonthId === activeMonth.id || !!activeMonth.approved_at) : false;
  const allDelivered = totalDeliverables > 0 && totalDelivered === totalDeliverables;

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="pointer-events-none fixed left-0 top-0 h-64 w-full bg-[radial-gradient(ellipse_60%_40%_at_30%_0%,rgba(212,168,83,0.06),transparent)]" />

      {/* Header */}
      <header className="border-b border-white/[0.06] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/12">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xs font-semibold tracking-tight text-white/80">{agencyName}</span>
              <span className="text-[9px] text-white/20 tracking-widest uppercase">powered by CineFlow</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {retainer.delivery_folder_url && (
              <a
                href={retainer.delivery_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/10 px-3 py-1.5 text-xs font-semibold text-[#d4a853] hover:bg-[#d4a853]/20 transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                All Content
              </a>
            )}
            <span className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
              retainer.is_active
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 bg-white/5 text-white/30"
            )}>
              {retainer.is_active ? "Active Retainer" : "Inactive"}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 space-y-6">

        {/* Client + month */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">{retainer.client_name}</h1>
          {activeMonth && (
            <div className="flex items-center gap-2 text-sm text-white/40">
              <span>{formatMonthYear(activeMonth.month_year)}</span>
              {monthStatusCfg && (
                <>
                  <span className="text-white/20">·</span>
                  <span className={monthStatusCfg.color}>{monthStatusCfg.label}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Overall progress */}
        {activeMonth && totalDeliverables > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Overall Progress</p>
              <span className="text-xl font-bold text-white tabular-nums">{overallPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/8 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${overallPct}%` }} />
            </div>
            <div className="flex gap-4 text-xs text-white/40">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{totalDelivered} delivered</span>
              {totalShot > 0 && <span className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-amber-400" />{totalShot} shot</span>}
              <span className="flex items-center gap-1.5"><Circle className="h-3.5 w-3.5 text-white/20" />{totalDeliverables - totalDelivered - totalShot} planned</span>
            </div>
          </div>
        )}

        {/* Shoot days */}
        {activeMonth && (() => {
          const days = (activeMonth.shoot_days ?? []) as ShootDayEntry[];
          // backward compat: show legacy single date if no shoot_days
          const displayDays: ShootDayEntry[] = days.length > 0
            ? days.filter(d => d.date)
            : activeMonth.shoot_date
              ? [{ id: "legacy", date: activeMonth.shoot_date }]
              : [];
          if (displayDays.length === 0) return null;
          return (
            <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#d4a853]/10">
                <CalendarDays className="h-3.5 w-3.5 text-[#d4a853]/60" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#d4a853]/50">
                  {displayDays.length === 1 ? "Shoot Day" : "Shoot Days"}
                </p>
              </div>
              <div className="divide-y divide-[#d4a853]/10">
                {displayDays.map((day) => (
                  <div key={day.id} className="px-4 py-3 space-y-0.5">
                    <p className="text-sm font-medium text-white/80">
                      {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                    {day.location && (
                      <p className="text-xs text-white/40 flex items-center gap-1.5">
                        <span className="text-[#d4a853]/50">📍</span>{day.location}
                      </p>
                    )}
                    {day.notes && (
                      <p className="text-xs text-white/30 italic mt-0.5">{day.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Month delivery link */}
        {activeMonth?.delivery_url && (
          <a
            href={activeMonth.delivery_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 hover:bg-emerald-500/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">Download {formatMonthYear(activeMonth.month_year)} Content</p>
                <p className="text-xs text-white/30 mt-0.5">Your files are ready</p>
              </div>
            </div>
            <span className="text-xs text-emerald-400/60 group-hover:text-emerald-400 transition-colors">Open →</span>
          </a>
        )}

        {/* Deliverables by type */}
        {activeMonth && deliverables.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Deliverables</p>
            {typeGroups.filter((g) => g.items.length > 0 || g.quantity > 0).map((g) => (
              <div key={g.type} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white/80">{g.label}</p>
                    <p className="text-xs text-white/30">
                      {g.quantity}× per month
                      {g.revisions_included ? ` · ${g.revisions_included} revision${g.revisions_included === 1 ? "" : "s"} included` : ""}
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full",
                    g.delivered === g.quantity ? "text-emerald-400 bg-emerald-400/10" : "text-white/30 bg-white/5"
                  )}>
                    {g.delivered}/{g.quantity}
                  </span>
                </div>
                <ProgressBar done={g.delivered} total={g.quantity} color={g.delivered === g.quantity ? "bg-emerald-400" : "bg-[#d4a853]"} />
                {g.items.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {g.items.map((item) => {
                      const cfg = DELIVERABLE_STATUS[item.status];
                      const hasRevision = item.revision_status !== "none" && item.revision_count > 0;
                      return (
                        <div key={item.id} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2", cfg.bg)}>
                          <span className={cfg.color}>{cfg.icon}</span>
                          <span className="flex-1 text-xs text-white/60 truncate">{item.title}</span>
                          {hasRevision && (
                            <span className="text-[10px] text-amber-400/70 shrink-0">Rev {item.revision_count}</span>
                          )}
                          <span className={cn("text-[10px] font-medium shrink-0", cfg.color)}>{cfg.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Approve month — show when all delivered and not yet approved */}
        {activeMonth && allDelivered && (
          <div className={cn(
            "rounded-xl border p-5 text-center space-y-3",
            isApproved
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-white/10 bg-white/[0.02]"
          )}>
            {isApproved ? (
              <>
                <CheckCheck className="mx-auto h-6 w-6 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">Content Approved</p>
                  <p className="text-xs text-white/30 mt-0.5">You signed off on {formatMonthYear(activeMonth.month_year)}</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-white/70">Happy with everything?</p>
                <p className="text-xs text-white/30">Tap below to formally sign off on this month's content.</p>
                <button
                  onClick={() => handleApprove(activeMonth.id)}
                  disabled={approving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="h-4 w-4" />
                  {approving ? "Approving…" : "Approve this month"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Client notes */}
        {activeMonth && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-white/30" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Notes to Your Studio</p>
              </div>
              {(savingNotes || notesSaved) && (
                <span className={cn(
                  "text-[10px] transition-opacity",
                  savingNotes ? "text-white/20" : "text-emerald-400"
                )}>
                  {savingNotes ? "Saving…" : "Saved"}
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={clientNotes}
              onChange={(e) => handleNotesChange(activeMonth.id, e.target.value)}
              placeholder="Leave a note for your team — requests, feedback, or anything on your mind for this month…"
              className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white/70 placeholder:text-white/15 outline-none focus:border-[#d4a853]/30 focus:ring-0 transition-colors"
            />
          </div>
        )}

        {/* No active month */}
        {!activeMonth && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-10 text-center space-y-2">
            <Repeat2 className="mx-auto h-7 w-7 text-white/15" />
            <p className="text-sm text-white/30">No active month yet — check back soon.</p>
          </div>
        )}

        {/* Month history */}
        {allMonths.length > 1 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">History</p>
            <div className="space-y-1">
              {allMonths.slice(1).map((m) => {
                const cfg = MONTH_STATUS_LABEL[m.status];
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/40">{formatMonthYear(m.month_year)}</span>
                      {m.approved_at && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400/60">
                          <CheckCheck className="h-3 w-3" /> Approved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {m.delivery_url && (
                        <a href={m.delivery_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-[#d4a853]/60 hover:text-[#d4a853] transition-colors"
                        >
                          <Download className="h-3 w-3" /> Files
                        </a>
                      )}
                      <span className={cn("text-[10px] font-medium", cfg.color)}>{cfg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      <footer className="border-t border-white/[0.04] px-4 py-6 text-center">
        <p className="text-[11px] text-white/15">
          Managed by <span className="text-white/25">{agencyName}</span> · Powered by CineFlow
        </p>
      </footer>
    </div>
  );
}
