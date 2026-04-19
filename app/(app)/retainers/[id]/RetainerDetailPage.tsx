"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Camera, CheckCircle2, Circle, Repeat2,
  CalendarDays, X, Pencil, Check, AlertCircle, Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getRetainer, getRetainerMonths, getRetainerDeliverables,
  createRetainerMonth, updateRetainerMonth, updateRetainer,
  createRetainerDeliverable, updateRetainerDeliverable, deleteRetainerDeliverable,
  deleteRetainer, createInvoice,
} from "@/lib/supabase/queries";
import type { Retainer, RetainerMonth, RetainerDeliverable, RetainerDeliverableStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMonthYear(my: string) {
  const [y, m] = my.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function currentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function nextAvailableMonth(existing: RetainerMonth[]): string {
  if (existing.length === 0) return currentMonthYear();
  // Find the latest month and suggest the one after
  const sorted = [...existing].sort((a, b) => b.month_year.localeCompare(a.month_year));
  const [y, m] = sorted[0].month_year.split("-").map(Number);
  const next = new Date(y, m); // JS months are 0-based, so m is already +1
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_CYCLE: Record<RetainerDeliverableStatus, RetainerDeliverableStatus> = {
  planned:   "shot",
  shot:      "delivered",
  delivered: "planned",
};

const STATUS_CONFIG: Record<RetainerDeliverableStatus, { icon: React.ReactNode; color: string; label: string }> = {
  planned:   { icon: <Circle className="h-4 w-4" />,       color: "text-muted-foreground/30",  label: "Planned" },
  shot:      { icon: <Camera className="h-4 w-4" />,       color: "text-amber-400",            label: "Shot" },
  delivered: { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-400",          label: "Delivered" },
};

const MONTH_STATUS_ORDER = ["planning", "active", "wrapped", "invoiced"] as const;
const MONTH_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning:  { label: "Planning",  color: "bg-muted text-muted-foreground border-border" },
  active:    { label: "Active",    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  wrapped:   { label: "Wrapped",   color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  invoiced:  { label: "Invoiced",  color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

// ── Deliverable row ──────────────────────────────────────────────────────────

function DeliverableRow({
  item,
  onStatusChange,
  onDelete,
  onTitleChange,
}: {
  item: RetainerDeliverable;
  onStatusChange: (id: string, s: RetainerDeliverableStatus) => void;
  onDelete: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const cfg = STATUS_CONFIG[item.status as RetainerDeliverableStatus] ?? STATUS_CONFIG.planned;

  function handleTitleBlur() {
    setEditing(false);
    if (title.trim() && title !== item.title) onTitleChange(item.id, title.trim());
    else setTitle(item.title);
  }

  return (
    <div className={cn(
      "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150",
      item.status === "delivered"
        ? "bg-emerald-500/[0.04] border border-emerald-500/10"
        : "hover:bg-muted/30 border border-transparent"
    )}>
      {/* Status toggle */}
      <button
        onClick={() => onStatusChange(item.id, STATUS_CYCLE[item.status as RetainerDeliverableStatus] ?? "planned")}
        className={cn("shrink-0 transition-all duration-150 hover:scale-110", cfg.color)}
        title={`Mark as ${STATUS_CYCLE[item.status as RetainerDeliverableStatus]}`}
      >
        {cfg.icon}
      </button>

      {/* Title — inline edit input or text */}
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={e => {
            if (e.key === "Enter") handleTitleBlur();
            if (e.key === "Escape") { setTitle(item.title); setEditing(false); }
          }}
          className="flex-1 bg-muted rounded px-2 py-0.5 text-sm text-foreground outline-none border border-[#d4a853]/30 focus:border-[#d4a853]/60"
        />
      ) : (
        <span className={cn(
          "flex-1 text-sm",
          item.status === "delivered" ? "text-muted-foreground/40 line-through" : "text-foreground"
        )}>
          {item.title}
        </span>
      )}

      {/* Hover actions */}
      {!editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded text-muted-foreground/50 hover:text-[#d4a853]/70 hover:bg-[#d4a853]/10 transition-colors"
            title="Rename"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 rounded text-muted-foreground/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Delete"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressPill({ label, done, total, color }: { label: string; done: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/60">{label}</span>
        <span className="text-[11px] text-muted-foreground/50">{done}/{total}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function RetainerDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [retainer, setRetainer] = useState<Retainer | null>(null);
  const [months, setMonths] = useState<RetainerMonth[]>([]);
  const [activeMonthId, setActiveMonthId] = useState<string | null>(null);
  const [deliverables, setDeliverables] = useState<RetainerDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingMonth, setStartingMonth] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddType, setQuickAddType] = useState("other");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState("");

  const activeMonth = months.find(m => m.id === activeMonthId) ?? null;

  // Load retainer + months
  async function load() {
    setLoading(true);
    try {
      const [r, ms] = await Promise.all([getRetainer(id), getRetainerMonths(id)]);
      setRetainer(r);
      setMonths(ms);
      if (ms.length > 0 && !activeMonthId) setActiveMonthId(ms[0].id);
    } finally {
      setLoading(false);
    }
  }

  // Load deliverables for active month
  async function loadDeliverables(monthId: string) {
    const ds = await getRetainerDeliverables(monthId);
    setDeliverables(ds);
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (activeMonthId) loadDeliverables(activeMonthId);
    else setDeliverables([]);
  }, [activeMonthId]);

  // ── Delete retainer ──────────────────────────────────────────────────────

  async function handleSaveRate() {
    if (!retainer) return;
    const rate = rateInput === "" ? null : Number(rateInput);
    try {
      await updateRetainer(id, { monthly_rate: rate ?? undefined });
      setRetainer(prev => prev ? { ...prev, monthly_rate: rate ?? undefined } : prev);
      toast.success("Rate updated");
    } catch {
      toast.error("Failed to update rate");
    } finally {
      setEditingRate(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteRetainer(id);
      toast.success("Retainer deleted");
      router.push("/retainers");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // ── Start a new month ────────────────────────────────────────────────────

  async function handleStartMonth() {
    if (!retainer) return;
    const monthYear = nextAvailableMonth(months);
    setStartingMonth(true);
    try {
      const m = await createRetainerMonth({
        retainer_id: retainer.id,
        month_year: monthYear,
        template: retainer.template,
      });
      const updated = [m, ...months];
      setMonths(updated);
      setActiveMonthId(m.id);
      toast.success(`${formatMonthYear(monthYear)} started`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start month");
    } finally {
      setStartingMonth(false);
    }
  }

  // ── Month status advance ─────────────────────────────────────────────────

  async function handleAdvanceStatus() {
    if (!activeMonth) return;
    const idx = MONTH_STATUS_ORDER.indexOf(activeMonth.status as any);
    if (idx >= MONTH_STATUS_ORDER.length - 1) return;
    const next = MONTH_STATUS_ORDER[idx + 1];
    await updateRetainerMonth(activeMonth.id, { status: next });
    setMonths(prev => prev.map(m => m.id === activeMonth.id ? { ...m, status: next } : m));
    toast.success(`Month marked as ${MONTH_STATUS_CONFIG[next].label}`);
  }

  // ── Create invoice from wrapped month ───────────────────────────────────

  async function handleCreateInvoice() {
    if (!retainer || !activeMonth) return;
    try {
      const monthLabel = formatMonthYear(activeMonth.month_year);
      const invoiceNum = `RET-${activeMonth.month_year.replace("-", "")}`;
      await createInvoice({
        client_name: retainer.client_name,
        invoice_number: invoiceNum,
        description: `Retainer — ${monthLabel}`,
        amount: retainer.monthly_rate ?? 0,
        status: "draft",
        amount_paid: 0,
        line_items: [{ id: "1", description: `Monthly retainer — ${monthLabel}`, quantity: 1, rate: retainer.monthly_rate ?? 0 }],
        currency: "USD",
        created_by: "",
      });
      toast.success("Draft invoice created", { description: "Open Finance to review and send." });
      router.push("/finance");
    } catch {
      toast.error("Failed to create invoice");
    }
  }

  // ── Shoot date ───────────────────────────────────────────────────────────

  async function handleShootDateChange(date: string) {
    if (!activeMonth) return;
    await updateRetainerMonth(activeMonth.id, { shoot_date: date || undefined });
    setMonths(prev => prev.map(m => m.id === activeMonth.id ? { ...m, shoot_date: date || undefined } : m));
  }

  // ── Deliverable actions ──────────────────────────────────────────────────

  async function handleStatusChange(delivId: string, newStatus: RetainerDeliverableStatus) {
    await updateRetainerDeliverable(delivId, { status: newStatus });
    setDeliverables(prev => prev.map(d => d.id === delivId ? { ...d, status: newStatus } : d));
  }

  async function handleDeleteDeliverable(delivId: string) {
    await deleteRetainerDeliverable(delivId);
    setDeliverables(prev => prev.filter(d => d.id !== delivId));
  }

  async function handleTitleChange(delivId: string, title: string) {
    await updateRetainerDeliverable(delivId, { title });
    setDeliverables(prev => prev.map(d => d.id === delivId ? { ...d, title } : d));
  }

  async function handleQuickAdd() {
    if (!quickAddTitle.trim() || !activeMonthId) return;
    try {
      const d = await createRetainerDeliverable({
        month_id: activeMonthId,
        title: quickAddTitle.trim(),
        type: quickAddType,
        sort_order: deliverables.length,
      });
      setDeliverables(prev => [...prev, d]);
      setQuickAddTitle("");
      toast.success("Added");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add");
    }
  }

  // ── Grouped deliverables ─────────────────────────────────────────────────

  const grouped = useMemo(() => {
    if (!retainer) return [];
    // Build groups from template order, then catch any "other"/quick-add types
    const templateTypes = retainer.template.map(t => t.type);
    const allTypes = [...new Set([...templateTypes, ...deliverables.map(d => d.type)])];

    return allTypes.map(type => {
      const templateItem = retainer.template.find(t => t.type === type);
      const items = deliverables.filter(d => d.type === type);
      const label = templateItem?.label ?? type.charAt(0).toUpperCase() + type.slice(1);
      const target = templateItem?.quantity ?? items.length;
      const done = items.filter(d => d.status === "delivered").length;
      const shot = items.filter(d => d.status === "shot").length;
      return { type, label, items, target, done, shot };
    }).filter(g => g.items.length > 0);
  }, [deliverables, retainer]);

  // ── Overall progress ─────────────────────────────────────────────────────

  const totalItems     = deliverables.length;
  const totalShot      = deliverables.filter(d => d.status !== "planned").length;
  const totalDelivered = deliverables.filter(d => d.status === "delivered").length;

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853] border-t-transparent" />
      </div>
    );
  }

  if (!retainer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">Retainer not found</p>
        <Link href="/retainers" className="text-[#d4a853] text-sm hover:underline">Back to Retainers</Link>
      </div>
    );
  }

  const nextStatus = activeMonth
    ? MONTH_STATUS_ORDER[MONTH_STATUS_ORDER.indexOf(activeMonth.status as any) + 1]
    : null;

  return (
    <div className="flex flex-col gap-0 h-full overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/retainers" className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground truncate">{retainer.client_name}</h1>
              <Badge className={cn("shrink-0 text-[10px] border", retainer.is_active
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
              )}>
                {retainer.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {editingRate ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[#d4a853]/60">$</span>
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    value={rateInput}
                    onChange={e => setRateInput(e.target.value.replace(/[^0-9]/g, ""))}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveRate(); if (e.key === "Escape") setEditingRate(false); }}
                    placeholder="0"
                    className="w-20 rounded border border-[#d4a853]/30 bg-muted px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-muted-foreground/50">/mo</span>
                  <button onClick={handleSaveRate} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={() => setEditingRate(false)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setRateInput(retainer.monthly_rate ? String(retainer.monthly_rate) : ""); setEditingRate(true); }}
                  className="group flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {retainer.monthly_rate
                    ? <span className="text-[#d4a853]/60">${retainer.monthly_rate.toLocaleString()}/mo</span>
                    : <span className="text-muted-foreground/40 italic">Set rate…</span>
                  }
                  <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
              <span className="hidden sm:inline text-xs text-muted-foreground/30">·</span>
              <span className="hidden sm:inline text-xs text-muted-foreground truncate">{retainer.template.map(t => `${t.quantity}× ${t.label}`).join(" · ")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Delete retainer */}
          {confirmDelete ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5">
              <span className="text-xs text-red-400 hidden sm:inline">Delete?</span>
              <button onClick={handleDelete} disabled={deleting} className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
                {deleting ? "…" : "Yes"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-md text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Delete retainer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          {/* Start month button */}
          <Button
            onClick={handleStartMonth}
            disabled={startingMonth}
            className="bg-[#d4a853] text-black font-medium hover:bg-[#c49843] h-8 text-xs sm:text-sm px-3 sm:px-4"
          >
            {startingMonth ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/40 border-t-black mr-1.5" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1" />
            )}
            <span className="hidden sm:inline">Start {formatMonthYear(nextAvailableMonth(months))}</span>
            <span className="sm:hidden">{formatMonthYear(nextAvailableMonth(months)).split(" ")[0]}</span>
          </Button>
        </div>
      </div>

      {/* ── No months yet ── */}
      {months.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/20">
            <CalendarDays className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm font-medium">No months started</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Start the first month to build out your deliverables checklist</p>
          </div>
        </div>
      )}

      {/* ── Month tabs + content ── */}
      {months.length > 0 && (
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

          {/* Mobile: horizontal pill tabs */}
          <div className="sm:hidden flex overflow-x-auto no-scrollbar gap-2 px-4 py-2.5 border-b border-border shrink-0">
            {months.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveMonthId(m.id)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all",
                  m.id === activeMonthId
                    ? "bg-[#d4a853]/15 text-foreground font-medium ring-[0.5px] ring-[#d4a853]/25"
                    : "bg-muted/40 text-muted-foreground/60"
                )}
              >
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                  m.status === "active"   ? "bg-emerald-400" :
                  m.status === "wrapped"  ? "bg-blue-400" :
                  m.status === "invoiced" ? "bg-violet-400" :
                  "bg-muted-foreground/30"
                )} />
                {formatMonthYear(m.month_year)}
              </button>
            ))}
          </div>

          {/* Desktop: left sidebar */}
          <div className="hidden sm:flex w-44 shrink-0 border-r border-border flex-col gap-0.5 p-2 overflow-y-auto">
            {months.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveMonthId(m.id)}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 text-xs",
                  m.id === activeMonthId
                    ? "bg-[#d4a853]/10 text-foreground font-medium ring-[0.5px] ring-inset ring-[#d4a853]/20"
                    : "text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    m.status === "active"   ? "bg-emerald-400" :
                    m.status === "wrapped"  ? "bg-blue-400" :
                    m.status === "invoiced" ? "bg-violet-400" :
                    "bg-muted-foreground/30"
                  )} />
                  <span className="capitalize text-[10px] text-muted-foreground/40">{m.status}</span>
                </div>
                <span className="leading-tight block">{formatMonthYear(m.month_year)}</span>
              </button>
            ))}
          </div>

          {/* Month detail */}
          {activeMonth && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">

                {/* Month header */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{formatMonthYear(activeMonth.month_year)}</h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={cn("text-[10px] border", MONTH_STATUS_CONFIG[activeMonth.status]?.color ?? "")}>
                          {MONTH_STATUS_CONFIG[activeMonth.status]?.label ?? activeMonth.status}
                        </Badge>
                        {activeMonth.shoot_date && (
                          <span className="text-xs text-muted-foreground">
                            Shoot: {new Date(activeMonth.shoot_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Shoot date input */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <input
                        type="date"
                        value={activeMonth.shoot_date ?? ""}
                        onChange={e => handleShootDateChange(e.target.value)}
                        className="bg-transparent text-xs text-muted-foreground/60 outline-none cursor-pointer [color-scheme:light_dark]"
                        title="Set shoot date"
                      />
                    </div>
                  </div>

                  {/* Action buttons row */}
                  {(nextStatus || activeMonth.status === "wrapped") && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {nextStatus && (
                        <Button
                          onClick={handleAdvanceStatus}
                          variant="outline"
                          className="h-8 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        >
                          Mark {MONTH_STATUS_CONFIG[nextStatus]?.label}
                        </Button>
                      )}
                      {activeMonth.status === "wrapped" && (
                        <Button
                          onClick={handleCreateInvoice}
                          variant="outline"
                          className="h-8 text-xs border-[#d4a853]/30 text-[#d4a853] hover:bg-[#d4a853]/10 hover:border-[#d4a853]/50"
                        >
                          Create Invoice
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress summary */}
                {totalItems > 0 && (
                  <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground/60 font-medium">Overall Progress</span>
                      <span className="text-xs text-muted-foreground/50">{totalDelivered}/{totalItems} delivered</span>
                    </div>
                    {grouped.map(g => (
                      <ProgressPill
                        key={g.type}
                        label={g.label}
                        done={g.done}
                        total={g.target}
                        color={
                          g.type === "short"   ? "bg-gradient-to-r from-[#d4a853] to-[#f0c060]" :
                          g.type === "photo"   ? "bg-gradient-to-r from-blue-500 to-cyan-400" :
                          g.type === "premium" ? "bg-gradient-to-r from-violet-500 to-purple-400" :
                          "bg-gradient-to-r from-[#d4a853] to-[#c49843]"
                        }
                      />
                    ))}
                  </div>
                )}

                {/* Deliverables grouped by type */}
                {grouped.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground text-sm">No deliverables yet</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {grouped.map(g => (
                      <div key={g.type}>
                        {/* Group header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">{g.label}</span>
                            <span className="text-[10px] text-muted-foreground/50">
                              {g.shot + g.done}/{g.target}
                              {g.done > 0 && <span className="text-emerald-400/70 ml-1">· {g.done} delivered</span>}
                            </span>
                          </div>
                        </div>
                        {/* Items */}
                        <div className="space-y-0.5">
                          {g.items.map(item => (
                            <DeliverableRow
                              key={item.id}
                              item={item}
                              onStatusChange={handleStatusChange}
                              onDelete={handleDeleteDeliverable}
                              onTitleChange={handleTitleChange}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick add */}
                {showQuickAdd ? (
                  <div className="flex gap-2 items-center rounded-lg border border-[#d4a853]/20 bg-[#d4a853]/[0.03] px-3 py-2">
                    <input
                      autoFocus
                      value={quickAddTitle}
                      onChange={e => setQuickAddTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleQuickAdd(); if (e.key === "Escape") { setShowQuickAdd(false); setQuickAddTitle(""); } }}
                      placeholder="Quick add deliverable…"
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
                    />
                    <select
                      value={quickAddType}
                      onChange={e => setQuickAddType(e.target.value)}
                      className="bg-transparent text-xs text-muted-foreground/60 outline-none cursor-pointer"
                    >
                      {(retainer?.template ?? []).map(t => (
                        <option key={t.type} value={t.type}>{t.label}</option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                    <button onClick={handleQuickAdd} disabled={!quickAddTitle.trim()} className="text-[#d4a853] disabled:text-muted-foreground/30 transition-colors">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setShowQuickAdd(false); setQuickAddTitle(""); }} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowQuickAdd(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-[#d4a853]/70 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Quick add
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
