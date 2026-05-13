"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, ChevronDown, Save, FolderOpen, X,
  Calculator, Pencil, Check, Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CalcLineItem, CalcCategory, RateCardItem, QuoteEstimate, Project, Profile, Quote } from "@/types";
import {
  getRateCardItems, getQuoteEstimates, saveQuoteEstimate,
  updateQuoteEstimate, deleteQuoteEstimate, getProjects, getProfile, getQuotes,
} from "@/lib/supabase/queries";
import QuoteFormModal, { type QuoteFormState, type LineItemForm } from "@/components/quotes/QuoteFormModal";

// ── Constants ─────────────────────────────────────────────────────────────────

export const CALC_CATEGORY_CONFIG: Record<CalcCategory, { label: string; color: string; bg: string; dot: string }> = {
  "pre-production": { label: "Pre-Production", color: "text-violet-400", bg: "bg-violet-400/10", dot: "bg-violet-400" },
  "production":     { label: "Production",     color: "text-amber-400",  bg: "bg-amber-400/10",  dot: "bg-amber-400"  },
  "post-production":{ label: "Post-Production", color: "text-cyan-400",  bg: "bg-cyan-400/10",   dot: "bg-cyan-400"   },
  "equipment":      { label: "Equipment",       color: "text-blue-400",  bg: "bg-blue-400/10",   dot: "bg-blue-400"   },
  "travel":         { label: "Travel",          color: "text-emerald-400",bg: "bg-emerald-400/10",dot: "bg-emerald-400"},
  "other":          { label: "Other",           color: "text-zinc-400",  bg: "bg-zinc-400/10",   dot: "bg-zinc-400"   },
};

const CATEGORIES = Object.keys(CALC_CATEGORY_CONFIG) as CalcCategory[];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function newLine(overrides?: Partial<CalcLineItem>): CalcLineItem {
  return {
    id: Math.random().toString(36).slice(2),
    service: "",
    category: "production",
    people: 1,
    days: 1,
    rate: 0,
    isFlat: false,
    ...overrides,
  };
}

function lineTotal(item: CalcLineItem): number {
  return item.isFlat ? item.rate : item.people * item.days * item.rate;
}

// ── Rate Card Popover ─────────────────────────────────────────────────────────

function RateCardPopover({
  items,
  onSelect,
  onClose,
}: {
  items: RateCardItem[];
  onSelect: (item: RateCardItem) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  const grouped = CATEGORIES.reduce<Record<CalcCategory, RateCardItem[]>>(
    (acc, cat) => ({ ...acc, [cat]: items.filter((i) => i.category === cat) }),
    {} as Record<CalcCategory, RateCardItem[]>
  );

  const hasAny = items.length > 0;

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Rate Card</p>
      </div>
      <div className="max-h-72 overflow-y-auto custom-scrollbar">
        {!hasAny ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground/50">No rate card items yet.</p>
            <p className="text-[10px] text-muted-foreground/30 mt-1">Add services in Settings → Rate Card.</p>
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            const catItems = grouped[cat];
            if (!catItems.length) return null;
            const cfg = CALC_CATEGORY_CONFIG[cat];
            return (
              <div key={cat}>
                <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 bg-muted/20">
                  {cfg.label}
                </p>
                {catItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { onSelect(item); onClose(); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/30 transition-colors"
                  >
                    <span className="text-sm text-foreground truncate">{item.name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono ml-2 shrink-0">
                      {fmt(item.default_rate)}{item.rate_type === "day" ? "/day" : " flat"}
                    </span>
                  </button>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Tier Card ─────────────────────────────────────────────────────────────────

function TierCard({
  label, sublabel, amount, multiplier, isRecommended, selected,
  onSelect, onMultChange, onBuildQuote,
}: {
  label: string; sublabel: string; amount: number; multiplier: number;
  isRecommended?: boolean; selected: boolean;
  onSelect: () => void; onMultChange: (v: number) => void; onBuildQuote: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(multiplier));

  function commitMult() {
    const v = parseFloat(draft);
    if (!isNaN(v) && v > 0) onMultChange(v);
    else setDraft(String(multiplier));
    setEditing(false);
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative rounded-xl border p-4 cursor-pointer transition-all",
        selected
          ? isRecommended
            ? "border-[#d4a853]/50 bg-[#d4a853]/8 ring-1 ring-[#d4a853]/20"
            : "border-border bg-card ring-1 ring-foreground/10"
          : "border-border/50 bg-card/50 hover:border-border hover:bg-card"
      )}
    >
      {isRecommended && (
        <span className="absolute -top-2 left-3 rounded-full bg-[#d4a853] px-2 py-0.5 text-[9px] font-bold text-black uppercase tracking-wide">
          Recommended
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={cn("text-[10px] font-bold uppercase tracking-widest", isRecommended ? "text-[#d4a853]" : "text-muted-foreground/60")}>
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground font-mono tabular-nums mt-0.5">{fmt(amount)}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sublabel}</p>
        </div>

        {/* Multiplier badge */}
        <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitMult}
              onKeyDown={(e) => e.key === "Enter" && commitMult()}
              className="w-14 rounded-md border border-[#d4a853]/40 bg-background px-1.5 py-0.5 text-xs font-mono text-center text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <button
              onClick={() => { setDraft(String(multiplier)); setEditing(true); }}
              className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-mono text-muted-foreground hover:border-border hover:text-foreground transition-colors"
            >
              ×{multiplier.toFixed(1)} <Pencil className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {selected && (
        <button
          onClick={(e) => { e.stopPropagation(); onBuildQuote(); }}
          className={cn(
            "mt-3 w-full rounded-lg py-2 text-xs font-bold transition-all active:scale-[0.98]",
            isRecommended
              ? "bg-[#d4a853] text-black hover:bg-[#c49843]"
              : "bg-foreground/10 text-foreground hover:bg-foreground/15"
          )}
        >
          Build Quote from This →
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function QuoteCalculator() {
  // ── Estimate state ─────────────────────────────────────────────────────────
  const [estimateTitle, setEstimateTitle] = useState("Untitled Estimate");
  const [editingTitle, setEditingTitle] = useState(false);
  const [lineItems, setLineItems] = useState<CalcLineItem[]>([newLine()]);
  const [overheadPct, setOverheadPct] = useState(20);
  const [floorMult, setFloorMult] = useState(1.0);
  const [stdMult, setStdMult] = useState(2.0);
  const [premiumMult, setPremiumMult] = useState(3.5);
  const [selectedTier, setSelectedTier] = useState<"floor" | "standard" | "premium">("standard");
  const [notes, setNotes] = useState("");

  // ── DB state ───────────────────────────────────────────────────────────────
  const [currentEstimateId, setCurrentEstimateId] = useState<string | null>(null);
  const [savedEstimates, setSavedEstimates] = useState<QuoteEstimate[]>([]);
  const [rateCardItems, setRateCardItems] = useState<RateCardItem[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Quote modal state ──────────────────────────────────────────────────────
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [showRateCard, setShowRateCard] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const loadMenuRef = useRef<HTMLDivElement>(null);

  // ── Fetch on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getRateCardItems(),
      getQuoteEstimates(),
      getProjects(),
      getProfile(),
      getQuotes(),
    ]).then(([rc, est, proj, prof, q]) => {
      setRateCardItems(rc);
      setSavedEstimates(est);
      setProjects(proj);
      setProfile(prof);
      setQuotes(q);
    }).catch(() => {});
  }, []);

  // Close load menu on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (loadMenuRef.current && !loadMenuRef.current.contains(e.target as Node))
        setShowLoadMenu(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ── Derived pricing ────────────────────────────────────────────────────────
  const subtotal   = lineItems.reduce((s, item) => s + lineTotal(item), 0);
  const overhead   = subtotal * (overheadPct / 100);
  const costTotal  = subtotal + overhead;
  const floor      = costTotal * floorMult;
  const standard   = costTotal * stdMult;
  const premium    = costTotal * premiumMult;

  const tierAmount = selectedTier === "floor" ? floor : selectedTier === "standard" ? standard : premium;
  const tierMult   = selectedTier === "floor" ? floorMult : selectedTier === "standard" ? stdMult : premiumMult;

  // ── Line item operations ───────────────────────────────────────────────────
  function updateItem<K extends keyof CalcLineItem>(id: string, key: K, value: CalcLineItem[K]) {
    setLineItems((prev) => prev.map((li) => li.id === id ? { ...li, [key]: value } : li));
  }

  function removeItem(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  function addFromRateCard(item: RateCardItem) {
    setLineItems((prev) => [
      ...prev,
      newLine({ service: item.name, category: item.category, rate: item.default_rate, isFlat: item.rate_type === "flat" }),
    ]);
  }

  // ── Save / Load ────────────────────────────────────────────────────────────
  const getPayload = useCallback(() => ({
    title: estimateTitle.trim() || "Untitled Estimate",
    line_items: lineItems,
    overhead_pct: overheadPct,
    floor_mult: floorMult,
    std_mult: stdMult,
    premium_mult: premiumMult,
    notes: notes || null,
  }), [estimateTitle, lineItems, overheadPct, floorMult, stdMult, premiumMult, notes]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = getPayload();
      if (currentEstimateId) {
        const updated = await updateQuoteEstimate(currentEstimateId, payload);
        setSavedEstimates((prev) => prev.map((e) => e.id === updated.id ? updated : e));
        toast.success("Estimate saved");
      } else {
        const created = await saveQuoteEstimate(payload);
        setSavedEstimates((prev) => [created, ...prev]);
        setCurrentEstimateId(created.id);
        toast.success("Estimate saved");
      }
    } catch {
      toast.error("Failed to save estimate");
    }
    setSaving(false);
  }

  function loadEstimate(est: QuoteEstimate) {
    setEstimateTitle(est.title);
    setLineItems(est.line_items.length ? est.line_items : [newLine()]);
    setOverheadPct(est.overhead_pct);
    setFloorMult(est.floor_mult);
    setStdMult(est.std_mult);
    setPremiumMult(est.premium_mult);
    setNotes(est.notes ?? "");
    setCurrentEstimateId(est.id);
    setShowLoadMenu(false);
  }

  function newEstimate() {
    setEstimateTitle("Untitled Estimate");
    setLineItems([newLine()]);
    setOverheadPct(20);
    setFloorMult(1.0);
    setStdMult(2.0);
    setPremiumMult(3.5);
    setNotes("");
    setCurrentEstimateId(null);
  }

  async function handleDeleteEstimate(id: string) {
    try {
      await deleteQuoteEstimate(id);
      setSavedEstimates((prev) => prev.filter((e) => e.id !== id));
      if (currentEstimateId === id) newEstimate();
      toast.success("Estimate deleted");
    } catch {
      toast.error("Failed to delete estimate");
    }
  }

  // ── Build Quote prefill ────────────────────────────────────────────────────
  function buildQuotePrefill(): Partial<QuoteFormState> {
    const scale = costTotal > 0 ? tierMult * (1 + overheadPct / 100) : 1;
    const prefillItems: LineItemForm[] = lineItems
      .filter((li) => li.service.trim())
      .map((li) => ({
        id: Math.random().toString(36).slice(2),
        description: li.service,
        quantity: li.isFlat ? "1" : String(li.people * li.days),
        rate: String(Math.round(li.rate * scale)),
      }));

    return {
      description: estimateTitle !== "Untitled Estimate" ? estimateTitle : "",
      line_items: prefillItems.length ? prefillItems : undefined,
    };
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d4a853]/10 border border-[#d4a853]/20">
          <Calculator className="h-4 w-4 text-[#d4a853]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Quote Calculator</h1>
          <p className="text-[11px] text-muted-foreground/50">Internal pricing tool — build estimates and turn them into quotes</p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {/* Load */}
          <div className="relative" ref={loadMenuRef}>
            <button
              onClick={() => setShowLoadMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Load
              <ChevronDown className="h-3 w-3" />
            </button>
            {showLoadMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Saved Estimates</p>
                  <button
                    onClick={newEstimate}
                    className="text-[10px] text-[#d4a853] hover:text-[#c49843] font-semibold transition-colors"
                  >
                    + New
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {savedEstimates.length === 0 ? (
                    <p className="px-4 py-5 text-xs text-muted-foreground/40 text-center">No saved estimates yet</p>
                  ) : (
                    savedEstimates.map((est) => (
                      <div key={est.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/20 group">
                        <button
                          onClick={() => loadEstimate(est)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-sm text-foreground truncate">{est.title}</p>
                          <p className="text-[10px] text-muted-foreground/40">
                            {new Date(est.updated_at).toLocaleDateString()}
                          </p>
                        </button>
                        <button
                          onClick={() => handleDeleteEstimate(est.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-muted-foreground/30 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || lineItems.every((li) => !li.service.trim())}
            className="flex items-center gap-1.5 rounded-lg bg-foreground/8 border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/12 disabled:opacity-40 transition-all"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : currentEstimateId ? "Update" : "Save"}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Left: Line items ─────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Estimate name */}
            <div className="flex items-center gap-2">
              {editingTitle ? (
                <input
                  autoFocus
                  value={estimateTitle}
                  onChange={(e) => setEstimateTitle(e.target.value)}
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                  className="flex-1 rounded-lg border border-[#d4a853]/40 bg-background px-3 py-1.5 text-base font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
                />
              ) : (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="flex items-center gap-2 group"
                >
                  <h2 className="text-base font-semibold text-foreground group-hover:text-[#d4a853] transition-colors">
                    {estimateTitle}
                  </h2>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-[#d4a853] transition-colors" />
                </button>
              )}
              {currentEstimateId && (
                <span className="text-[10px] text-muted-foreground/30 font-medium">· saved</span>
              )}
            </div>

            {/* Line items table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_56px_56px_96px_80px_32px] gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
                {["Service", "People", "Days", "Rate/Day", "Total", ""].map((h) => (
                  <span key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center first:text-left last:text-right">
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/40">
                {lineItems.map((item) => {
                  const cfg = CALC_CATEGORY_CONFIG[item.category];
                  const total = lineTotal(item);
                  return (
                    <div key={item.id} className="grid grid-cols-[1fr_56px_56px_96px_80px_32px] gap-2 px-4 py-2.5 items-center group hover:bg-muted/10 transition-colors">
                      {/* Service name + category */}
                      <div className="flex items-center gap-2 min-w-0">
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item.id, "category", e.target.value as CalcCategory)}
                          className="sr-only"
                          title="Category"
                        />
                        <button
                          onClick={() => {
                            const idx = CATEGORIES.indexOf(item.category);
                            updateItem(item.id, "category", CATEGORIES[(idx + 1) % CATEGORIES.length]);
                          }}
                          title={cfg.label}
                          className={cn("h-2 w-2 shrink-0 rounded-full transition-transform hover:scale-125", cfg.dot)}
                        />
                        <input
                          value={item.service}
                          onChange={(e) => updateItem(item.id, "service", e.target.value)}
                          placeholder="Service or crew role"
                          className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
                        />
                      </div>
                      {/* People */}
                      <input
                        type="number" min="0" value={item.people}
                        onChange={(e) => updateItem(item.id, "people", Math.max(0, Number(e.target.value)))}
                        disabled={item.isFlat}
                        className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-center font-mono text-foreground focus:border-border focus:bg-background focus:outline-none transition-colors disabled:opacity-30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {/* Days */}
                      <input
                        type="number" min="0" value={item.days}
                        onChange={(e) => updateItem(item.id, "days", Math.max(0, Number(e.target.value)))}
                        disabled={item.isFlat}
                        className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-center font-mono text-foreground focus:border-border focus:bg-background focus:outline-none transition-colors disabled:opacity-30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {/* Rate */}
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50">$</span>
                        <input
                          type="number" min="0" value={item.rate}
                          onChange={(e) => updateItem(item.id, "rate", Math.max(0, Number(e.target.value)))}
                          className="w-full rounded-md border border-transparent bg-transparent pl-5 pr-1.5 py-1 text-sm font-mono text-foreground text-right focus:border-border focus:bg-background focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      {/* Total */}
                      <p className="text-sm font-semibold text-foreground text-right font-mono tabular-nums">
                        {total > 0 ? fmt(total) : "—"}
                      </p>
                      {/* Delete */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground/30 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subtotal row */}
              {lineItems.length > 0 && (
                <div className="grid grid-cols-[1fr_56px_56px_96px_80px_32px] gap-2 px-4 py-2.5 border-t border-border bg-muted/10">
                  <span className="text-xs text-muted-foreground/50 font-medium col-span-4">Subtotal (crew & services cost)</span>
                  <span className="text-sm font-bold text-foreground text-right font-mono tabular-nums">{fmt(subtotal)}</span>
                  <span />
                </div>
              )}

            </div>

            {/* Add buttons — outside card so dropdown isn't clipped */}
            <div className="flex items-center gap-3 relative">
              <div className="relative">
                <button
                  onClick={() => setShowRateCard((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#d4a853] hover:text-[#c49843] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add from Rate Card
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showRateCard && "rotate-180")} />
                </button>
                {showRateCard && (
                  <RateCardPopover
                    items={rateCardItems}
                    onSelect={addFromRateCard}
                    onClose={() => setShowRateCard(false)}
                  />
                )}
              </div>
              <span className="text-muted-foreground/20 text-xs">·</span>
              <button
                onClick={() => setLineItems((prev) => [...prev, newLine()])}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Custom line
              </button>
            </div>

            {/* Overhead */}
            <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Business Overhead</p>
                  <p className="text-[10px] text-muted-foreground/50">Added on top of crew/service costs before markup</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
                  <input
                    type="number" min="0" max="100" value={overheadPct}
                    onChange={(e) => setOverheadPct(Math.max(0, Number(e.target.value)))}
                    className="w-10 bg-transparent text-sm font-mono text-foreground text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <span className="text-sm font-semibold text-foreground font-mono">{fmt(overhead)}</span>
              </div>
            </div>

            {/* Cost total summary */}
            <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#d4a853]/70">Total Job Cost</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Subtotal + overhead — your floor reference</p>
              </div>
              <p className="text-2xl font-bold text-[#d4a853] font-mono tabular-nums">{fmt(costTotal)}</p>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Internal Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Scope notes, assumptions, exclusions… (internal only)"
                rows={3}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30 focus:border-[#d4a853]/30 transition-colors resize-none"
              />
            </div>
          </div>

          {/* ── Right: Pricing panel ──────────────────────────────────── */}
          <div className="lg:sticky lg:top-6 flex flex-col gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Quote Range</p>
              <p className="text-[10px] text-muted-foreground/30">Click a tier to select, then build your quote</p>
            </div>

            <TierCard
              label="Floor"
              sublabel="Minimum — don't quote below this"
              amount={floor}
              multiplier={floorMult}
              selected={selectedTier === "floor"}
              onSelect={() => setSelectedTier("floor")}
              onMultChange={setFloorMult}
              onBuildQuote={() => { setShowQuoteModal(true); }}
            />
            <TierCard
              label="Standard"
              sublabel="Your typical rate"
              amount={standard}
              multiplier={stdMult}
              isRecommended
              selected={selectedTier === "standard"}
              onSelect={() => setSelectedTier("standard")}
              onMultChange={setStdMult}
              onBuildQuote={() => { setShowQuoteModal(true); }}
            />
            <TierCard
              label="Premium"
              sublabel="Rush jobs / premium clients"
              amount={premium}
              multiplier={premiumMult}
              selected={selectedTier === "premium"}
              onSelect={() => setSelectedTier("premium")}
              onMultChange={setPremiumMult}
              onBuildQuote={() => { setShowQuoteModal(true); }}
            />

            <p className="text-[9px] text-muted-foreground/30 text-center">
              Click ×N on any tier to edit its multiplier
            </p>

            {/* Summary */}
            {subtotal > 0 && (
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-muted-foreground/60">
                  <span>Crew / services</span>
                  <span className="font-mono">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground/60">
                  <span>Overhead ({overheadPct}%)</span>
                  <span className="font-mono">{fmt(overhead)}</span>
                </div>
                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5">
                  <span>Cost total</span>
                  <span className="font-mono">{fmt(costTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-[#d4a853] border-t border-border pt-1.5">
                  <span>{selectedTier === "floor" ? "Floor" : selectedTier === "standard" ? "Standard" : "Premium"} quote</span>
                  <span className="font-mono">{fmt(tierAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quote Modal ──────────────────────────────────────────────────── */}
      <QuoteFormModal
        open={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        onSave={async () => { setShowQuoteModal(false); toast.success("Quote created — find it in Finance → Quotes"); }}
        initial={buildQuotePrefill()}
        projects={projects}
        profile={profile}
        quotes={quotes}
      />
    </div>
  );
}
