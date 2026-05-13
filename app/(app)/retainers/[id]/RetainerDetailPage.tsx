"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Camera, CheckCircle2, Circle, Repeat2,
  CalendarDays, X, Pencil, Check, AlertCircle, Trash2, Settings2, Link2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getRetainer, getRetainerMonths, getRetainerDeliverables,
  createRetainerMonth, updateRetainerMonth, updateRetainer,
  createRetainerDeliverable, updateRetainerDeliverable, deleteRetainerDeliverable,
  bulkCreateRetainerDeliverables, deleteRetainer, createInvoice,
} from "@/lib/supabase/queries";
import type { Retainer, RetainerMonth, RetainerDeliverable, RetainerDeliverableStatus, RetainerTemplateItem } from "@/types";
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
  const [editOpen, setEditOpen] = useState(false);
  const [editClientName, setEditClientName] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editTemplate, setEditTemplate] = useState<RetainerTemplateItem[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [schedulingCalendar, setSchedulingCalendar] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [sharingPortal, setSharingPortal] = useState(false);

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

  function openEdit() {
    if (!retainer) return;
    setEditClientName(retainer.client_name);
    setEditClientEmail(retainer.client_email ?? "");
    setEditRate(retainer.monthly_rate ? String(retainer.monthly_rate) : "");
    setEditTemplate(retainer.template.map((t) => ({ ...t })));
    setEditNotes(retainer.notes ?? "");
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!retainer || !editClientName.trim()) { toast.error("Client name is required"); return; }
    if (editTemplate.some((t) => !t.label.trim())) { toast.error("All deliverables need a label"); return; }
    setSavingEdit(true);
    const newTemplate = editTemplate.filter((t) => t.quantity > 0);
    try {
      await updateRetainer(id, {
        client_name: editClientName.trim(),
        client_email: editClientEmail.trim() || undefined,
        monthly_rate: editRate ? Number(editRate) : undefined,
        template: newTemplate,
        notes: editNotes.trim() || undefined,
      });

      // Sync deliverables for the active month — add any rows missing due to quantity increases
      if (activeMonthId) {
        const toAdd: { month_id: string; title: string; type: string; sort_order: number }[] = [];
        let maxSort = deliverables.reduce((m, d) => Math.max(m, d.sort_order), -1);

        for (const item of newTemplate) {
          const mode = item.mode ?? (item.type === "photo" || item.type === "story" ? "batch" : "individual");
          const existing = deliverables.filter((d) => d.type === item.type);

          if (mode === "batch") {
            // One batch row per type — only add if none exist yet
            if (existing.length === 0) {
              toAdd.push({
                month_id: activeMonthId,
                title: item.quantity > 1 ? `${item.label} · ${item.quantity}` : item.label,
                type: item.type,
                sort_order: ++maxSort,
              });
            }
          } else {
            // Individual — add rows for the deficit
            const deficit = item.quantity - existing.length;
            for (let i = 1; i <= deficit; i++) {
              const num = existing.length + i;
              const suffix = item.quantity > 1 ? ` ${num}` : "";
              toAdd.push({
                month_id: activeMonthId,
                title: `${item.label}${suffix}`,
                type: item.type,
                sort_order: ++maxSort,
              });
            }
          }
        }

        if (toAdd.length > 0) {
          const created = await bulkCreateRetainerDeliverables(toAdd);
          setDeliverables((prev) => [...prev, ...created]);
        }
      }

      setRetainer((prev) => prev ? {
        ...prev,
        client_name: editClientName.trim(),
        client_email: editClientEmail.trim() || undefined,
        monthly_rate: editRate ? Number(editRate) : undefined,
        template: newTemplate,
        notes: editNotes.trim() || undefined,
      } : prev);
      setEditOpen(false);
      toast.success("Retainer updated");
    } catch {
      toast.error("Failed to update retainer");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleActive() {
    if (!retainer) return;
    setTogglingActive(true);
    try {
      await updateRetainer(id, { is_active: !retainer.is_active });
      setRetainer((prev) => prev ? { ...prev, is_active: !prev.is_active } : prev);
      toast.success(retainer.is_active ? "Retainer paused" : "Retainer activated");
    } catch {
      toast.error("Failed to update");
    } finally {
      setTogglingActive(false);
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

  // ── Share client portal ──────────────────────────────────────────────────

  async function handleSharePortal() {
    if (!retainer) return;
    setSharingPortal(true);
    try {
      let token = retainer.portal_token;
      if (!token) {
        token = crypto.randomUUID();
        await updateRetainer(id, { portal_token: token });
        setRetainer((prev) => prev ? { ...prev, portal_token: token! } : prev);
      }
      const url = `${window.location.origin}/portal/retainer/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success(retainer.portal_token ? "Portal link copied!" : "Portal link created & copied!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate link");
    } finally {
      setSharingPortal(false);
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

      if (retainer.client_email) {
        fetch("/api/retainer/notify-start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retainerId: retainer.id, monthId: m.id }),
        })
          .then((r) => r.json())
          .then((d) => { if (d.sent > 0) toast.success("Kickoff email sent to client"); })
          .catch(() => { /* best-effort */ });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start month");
    } finally {
      setStartingMonth(false);
    }
  }

  // ── Month status advance ─────────────────────────────────────────────────

  async function handleSetStatus(newStatus: typeof MONTH_STATUS_ORDER[number]) {
    if (!activeMonth || activeMonth.status === newStatus) return;
    await updateRetainerMonth(activeMonth.id, { status: newStatus });
    setMonths(prev => prev.map(m => m.id === activeMonth.id ? { ...m, status: newStatus } : m));
  }

  // ── Create invoice from wrapped month ───────────────────────────────────

  async function handleCreateInvoice() {
    if (!retainer || !activeMonth) return;
    try {
      const monthLabel = formatMonthYear(activeMonth.month_year);
      const invoiceNum = `RET-${activeMonth.month_year.replace("-", "")}`;
      const today = new Date().toISOString().split("T")[0];
      await createInvoice({
        client_name: retainer.client_name,
        invoice_number: invoiceNum,
        description: `Retainer — ${monthLabel}`,
        amount: retainer.monthly_rate ?? 0,
        status: "draft",
        amount_paid: 0,
        tax_rate: 0,
        payment_terms: "net30",
        invoice_date: today,
        line_items: [{ id: "1", description: `Monthly retainer — ${monthLabel}`, quantity: 1, rate: retainer.monthly_rate ?? 0 }],
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

  // ── Schedule production day on calendar ─────────────────────────────────

  async function handleScheduleProductionDay() {
    if (!retainer || !activeMonth?.shoot_date) return;
    setSchedulingCalendar(true);
    try {
      const start = new Date(`${activeMonth.shoot_date}T09:00:00`);
      const end   = new Date(`${activeMonth.shoot_date}T18:00:00`);
      const { createCalendarEvent } = await import("@/lib/supabase/queries");
      const ev = await createCalendarEvent({
        title: `${retainer.client_name} — Production Day`,
        type: "shoot",
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        description: `Retainer shoot for ${retainer.client_name} (${activeMonth.month_year})`,
      });
      toast.success("Added to Calendar");

      if (retainer.client_email) {
        fetch("/api/calendar/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: ev.id,
            recipientEmail: retainer.client_email,
            recipientName: retainer.client_name,
          }),
        })
          .then((r) => r.json())
          .then((d) => { if (d.sent > 0) toast.success("Client notified by email"); })
          .catch(() => { /* best-effort */ });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to schedule");
    } finally {
      setSchedulingCalendar(false);
    }
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
          {/* Active/Inactive toggle */}
          <button
            onClick={handleToggleActive}
            disabled={togglingActive}
            className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              retainer.is_active
                ? "border-border text-muted-foreground hover:border-red-400/30 hover:text-red-400"
                : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
            }`}
            title={retainer.is_active ? "Pause retainer" : "Activate retainer"}
          >
            {retainer.is_active ? "Pause" : "Activate"}
          </button>

          {/* Share client portal */}
          <button
            onClick={handleSharePortal}
            disabled={sharingPortal}
            className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/8 px-2.5 py-1.5 text-xs font-medium text-[#d4a853]/80 hover:border-[#d4a853]/50 hover:text-[#d4a853] hover:bg-[#d4a853]/12 transition-colors disabled:opacity-50"
            title={retainer.portal_token ? "Copy client portal link" : "Generate & copy client portal link"}
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{retainer.portal_token ? "Copy Link" : "Share Portal"}</span>
          </button>

          {/* Edit retainer */}
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Edit retainer"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </button>

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
                    <h2 className="text-lg font-semibold text-foreground">{formatMonthYear(activeMonth.month_year)}</h2>

                    {/* Shoot date + schedule button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <input
                        type="date"
                        value={activeMonth.shoot_date ?? ""}
                        onChange={e => handleShootDateChange(e.target.value)}
                        className="bg-transparent text-xs text-muted-foreground/60 outline-none cursor-pointer [color-scheme:light_dark]"
                        title="Set shoot date"
                      />
                      {activeMonth.shoot_date && (
                        <button
                          onClick={handleScheduleProductionDay}
                          disabled={schedulingCalendar}
                          title={retainer.client_email ? "Add to Calendar + email client" : "Add to Calendar"}
                          className="flex items-center gap-1 rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10 px-2 py-0.5 text-[11px] font-medium text-[#d4a853] hover:bg-[#d4a853]/20 transition-colors disabled:opacity-50"
                        >
                          <CalendarDays className="h-3 w-3" />
                          {schedulingCalendar ? "Scheduling…" : "Add to Calendar"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status segmented control */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 border border-border w-fit">
                      {MONTH_STATUS_ORDER.map((s) => {
                        const isActive = activeMonth.status === s;
                        const cfg = MONTH_STATUS_CONFIG[s];
                        return (
                          <button
                            key={s}
                            onClick={() => handleSetStatus(s)}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150",
                              isActive
                                ? cn("shadow-sm", cfg.color)
                                : "text-muted-foreground/40 hover:text-muted-foreground"
                            )}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                    {activeMonth.status === "wrapped" && (
                      <Button
                        onClick={handleCreateInvoice}
                        variant="outline"
                        size="sm"
                        className="w-fit h-7 text-xs border-[#d4a853]/30 text-[#d4a853] hover:bg-[#d4a853]/10 hover:border-[#d4a853]/50"
                      >
                        Create Invoice →
                      </Button>
                    )}
                  </div>
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

      {/* ── Edit retainer modal ── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Edit Retainer</h2>
              <button onClick={() => setEditOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Client Name</label>
                <Input value={editClientName} onChange={(e) => setEditClientName(e.target.value)} placeholder="e.g. Nike" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Client Email <span className="text-muted-foreground/40">(for booking confirmations)</span></label>
                <Input type="email" value={editClientEmail} onChange={(e) => setEditClientEmail(e.target.value)} placeholder="client@company.com" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Monthly Rate (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50">$</span>
                  <Input type="text" inputMode="numeric" value={editRate} onChange={(e) => setEditRate(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="5000" className="pl-6" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Monthly Deliverables</label>
                <div className="space-y-2">
                  {editTemplate.map((item, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex gap-2 items-center">
                        <Input value={item.label} onChange={(e) => setEditTemplate((prev) => prev.map((t, i) => i === idx ? { ...t, label: e.target.value } : t))} placeholder="Deliverable label" className="flex-1 text-sm h-9" />
                        <input type="text" inputMode="numeric" value={item.quantity === 0 ? "" : String(item.quantity)}
                          onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ""); setEditTemplate((prev) => prev.map((t, i) => i === idx ? { ...t, quantity: raw === "" ? 0 : Number(raw) } : t)); }}
                          className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
                        />
                        <button onClick={() => setEditTemplate((prev) => prev.filter((_, i) => i !== idx))} className="text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1 ml-0.5">
                        {(["individual", "batch"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setEditTemplate((prev) => prev.map((t, i) => i === idx ? { ...t, mode: m } : t))}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full border transition-colors capitalize",
                              (item.mode ?? "individual") === m
                                ? "bg-[#d4a853]/15 border-[#d4a853]/30 text-[#d4a853]"
                                : "border-border text-muted-foreground/50 hover:text-muted-foreground"
                            )}
                          >{m}</button>
                        ))}
                        <span className="text-[10px] text-muted-foreground/40 self-center ml-1">
                          {(item.mode ?? "individual") === "batch" ? "→ 1 row, check off the whole group" : `→ ${item.quantity} rows, name each one`}
                        </span>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setEditTemplate((prev) => [...prev, { type: "other", label: "", quantity: 1 }])} className="text-xs text-[#d4a853]/70 hover:text-[#d4a853] transition-colors flex items-center gap-1 mt-1">
                    <Plus className="h-3 w-3" /> Add deliverable type
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Notes (optional)</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Scope notes, special requirements..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" onClick={() => setEditOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 bg-[#d4a853] text-black font-medium hover:bg-[#c49843]">
                {savingEdit ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
