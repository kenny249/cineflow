"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, ChevronDown, Save, FolderOpen, X,
  Calculator, Pencil, Info, Sparkles, Loader2, Users, BookTemplate, Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CalcLineItem, CalcCategory, RateCardItem, QuoteEstimate, Project, Profile, Quote, CrewProfile, QuotePackage, LineItem, RetainerTemplateItem } from "@/types";
import {
  getRateCardItems, getQuoteEstimates, saveQuoteEstimate,
  updateQuoteEstimate, deleteQuoteEstimate, getProjects, getProfile, updateProfile, getQuotes,
  getMyCrewProfiles, createQuote,
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

// ── Project type templates ────────────────────────────────────────────────────

const PROJECT_TEMPLATES: { label: string; items: Partial<CalcLineItem>[] }[] = [
  {
    label: "Commercial",
    items: [
      { service: "Director", category: "pre-production", people: 1, days: 2, rate: 1500, rateType: "day" as const },
      { service: "DP / Camera Op", category: "production", people: 1, days: 2, rate: 900, rateType: "day" as const },
      { service: "Gaffer", category: "production", people: 1, days: 2, rate: 550, rateType: "day" as const },
      { service: "Production Assistant", category: "production", people: 2, days: 2, rate: 300, rateType: "day" as const },
      { service: "Camera & Lens Package", category: "equipment", people: 1, days: 2, rate: 650, rateType: "day" as const },
      { service: "Edit & Color Grade", category: "post-production", people: 1, days: 3, rate: 900, rateType: "day" as const },
    ],
  },
  {
    label: "Social Content",
    items: [
      { service: "Videographer", category: "production", people: 1, days: 1, rate: 700, rateType: "day" as const },
      { service: "Content Strategist", category: "pre-production", people: 1, days: 1, rate: 600, rateType: "day" as const },
      { service: "Edit (per video)", category: "post-production", people: 1, days: 2, rate: 400, rateType: "day" as const },
      { service: "Motion Graphics", category: "post-production", people: 1, days: 1, rate: 500, rateType: "day" as const },
    ],
  },
  {
    label: "Documentary",
    items: [
      { service: "Director / DP", category: "production", people: 1, days: 5, rate: 1200, rateType: "day" as const },
      { service: "Sound Recordist", category: "production", people: 1, days: 5, rate: 600, rateType: "day" as const },
      { service: "Production Coordinator", category: "pre-production", people: 1, days: 3, rate: 500, rateType: "day" as const },
      { service: "Edit & Color Grade", category: "post-production", people: 1, days: 8, rate: 800, rateType: "day" as const },
      { service: "Sound Mix & Master", category: "post-production", people: 1, days: 2, rate: 700, rateType: "day" as const },
    ],
  },
  {
    label: "Brand Film",
    items: [
      { service: "Creative Director", category: "pre-production", people: 1, days: 2, rate: 1500, rateType: "day" as const },
      { service: "DP", category: "production", people: 1, days: 3, rate: 1000, rateType: "day" as const },
      { service: "Gaffer + Electric", category: "production", people: 2, days: 3, rate: 600, rateType: "day" as const },
      { service: "Art Director", category: "pre-production", people: 1, days: 2, rate: 900, rateType: "day" as const },
      { service: "Camera + Lens Package", category: "equipment", people: 1, days: 3, rate: 800, rateType: "day" as const },
      { service: "Edit, Color & Sound", category: "post-production", people: 1, days: 5, rate: 900, rateType: "day" as const },
    ],
  },
  {
    label: "Event Coverage",
    items: [
      { service: "Lead Videographer", category: "production", people: 1, days: 1, rate: 900, rateType: "day" as const },
      { service: "2nd Camera Op", category: "production", people: 1, days: 1, rate: 650, rateType: "day" as const },
      { service: "Photographer", category: "production", people: 1, days: 1, rate: 700, rateType: "day" as const },
      { service: "Same-Day Edit", category: "post-production", people: 1, days: 1, rate: 600, rateType: "day" as const },
      { service: "Full Highlight Edit", category: "post-production", people: 1, days: 2, rate: 800, rateType: "day" as const },
    ],
  },
  {
    label: "Music Video",
    items: [
      { service: "Director", category: "pre-production", people: 1, days: 2, rate: 1800, rateType: "day" as const },
      { service: "DP", category: "production", people: 1, days: 2, rate: 1000, rateType: "day" as const },
      { service: "Gaffer", category: "production", people: 1, days: 2, rate: 550, rateType: "day" as const },
      { service: "Art Director / Stylist", category: "pre-production", people: 1, days: 2, rate: 700, rateType: "day" as const },
      { service: "Wardrobe Stylist", category: "production", people: 1, days: 2, rate: 500, rateType: "day" as const },
      { service: "Hair & Makeup", category: "production", people: 1, days: 2, rate: 450, rateType: "day" as const },
      { service: "Production Assistant", category: "production", people: 2, days: 2, rate: 300, rateType: "day" as const },
      { service: "Camera Package", category: "equipment", people: 1, days: 2, rate: 700, rateType: "day" as const },
      { service: "Lighting Package", category: "equipment", people: 1, days: 2, rate: 400, rateType: "day" as const },
      { service: "Edit, Color & VFX", category: "post-production", people: 1, days: 5, rate: 900, rateType: "day" as const },
    ],
  },
  {
    label: "TV Spot",
    items: [
      { service: "Director", category: "pre-production", people: 1, days: 3, rate: 2500, rateType: "day" as const },
      { service: "DP", category: "production", people: 1, days: 2, rate: 1200, rateType: "day" as const },
      { service: "Gaffer + Best Boy", category: "production", people: 2, days: 2, rate: 600, rateType: "day" as const },
      { service: "Key Grip", category: "production", people: 1, days: 2, rate: 550, rateType: "day" as const },
      { service: "Production Coordinator", category: "pre-production", people: 1, days: 5, rate: 500, rateType: "day" as const },
      { service: "Art Department", category: "pre-production", people: 2, days: 3, rate: 650, rateType: "day" as const },
      { service: "Wardrobe Stylist", category: "production", people: 1, days: 2, rate: 600, rateType: "day" as const },
      { service: "Camera & Lens Package", category: "equipment", people: 1, days: 2, rate: 900, rateType: "day" as const },
      { service: "Lighting & Grip Package", category: "equipment", people: 1, days: 2, rate: 600, rateType: "day" as const },
      { service: "Edit & VFX / Motion", category: "post-production", people: 1, days: 5, rate: 1000, rateType: "day" as const },
      { service: "Color Grade", category: "post-production", people: 1, days: 2, rate: 900, rateType: "day" as const },
      { service: "Sound Design & Mix", category: "post-production", people: 1, days: 1, rate: 700, rateType: "day" as const },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    rateType: "day",
    ...overrides,
  };
}

function lineTotal(item: CalcLineItem): number {
  const rt = item.rateType ?? (item.isFlat ? "flat" : "day");
  if (rt === "flat") return item.rate;
  if (rt === "unit") return item.days * item.rate;
  // "hour" and "day" both use people × qty × rate
  return item.people * item.days * item.rate;
}

// ── Rate Card Popover ─────────────────────────────────────────────────────────

function RateCardPopover({
  items,
  crew,
  onSelect,
  onSelectCrew,
}: {
  items: RateCardItem[];
  crew: CrewProfile[];
  onSelect: (item: RateCardItem) => void;
  onSelectCrew: (member: CrewProfile) => void;
}) {
  const grouped = CATEGORIES.reduce<Record<CalcCategory, RateCardItem[]>>(
    (acc, cat) => ({ ...acc, [cat]: items.filter((i) => i.category === cat) }),
    {} as Record<CalcCategory, RateCardItem[]>
  );

  const hasCrew = crew.length > 0;
  const hasItems = items.length > 0;

  return (
    <div
      className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Add Line Item</p>
      </div>
      <div className="max-h-80 overflow-y-auto custom-scrollbar">
        {/* Crew section */}
        {hasCrew && (
          <div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/20">
              <Users className="h-3 w-3 text-muted-foreground/40" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Crew</p>
            </div>
            {crew.map((member) => {
              const rate = member.day_rate_min ?? 0;
              return (
                <button
                  key={member.id}
                  onClick={() => onSelectCrew(member)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/30 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-sm text-foreground truncate block">{member.name}</span>
                    <span className="text-[10px] text-muted-foreground/50">{member.primary_role}</span>
                  </div>
                  {rate > 0 && (
                    <span className="text-[11px] text-muted-foreground font-mono ml-2 shrink-0">
                      {fmt(rate)}/day
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Rate card items */}
        {hasItems ? (
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
                    onClick={() => onSelect(item)}
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
        ) : !hasCrew ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground/50">No rate card items or crew yet.</p>
            <p className="text-[10px] text-muted-foreground/30 mt-1">Add services in Settings → Rate Card.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Tier Card ─────────────────────────────────────────────────────────────────

function TierCard({
  label, sublabel, amount, multiplier, selected,
  onSelect, onMultChange, onBuildQuote,
}: {
  label: string; sublabel: string; amount: number; multiplier: number;
  selected: boolean;
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
        "rounded-xl border p-4 cursor-pointer transition-all",
        selected
          ? "border-[#d4a853]/30 bg-[#d4a853]/5 ring-1 ring-[#d4a853]/10"
          : "border-border/50 bg-card/50 hover:border-border hover:bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
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
              className="w-14 rounded-md border border-[#d4a853]/40 bg-background px-1.5 py-0.5 text-xs font-mono text-center text-foreground focus:outline-none"
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
          className="mt-3 w-full rounded-lg bg-[#d4a853] py-2 text-xs font-bold text-black hover:bg-[#c49843] transition-all active:scale-[0.98]"
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
  const [crewProfiles, setCrewProfiles] = useState<CrewProfile[]>([]);
  const [saving, setSaving] = useState(false);

  const router = useRouter();

  // ── Quote modal state ──────────────────────────────────────────────────────
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteSaved, setQuoteSaved] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  // ── Custom templates state ─────────────────────────────────────────────────
  const [customTemplates, setCustomTemplates] = useState<Profile["quote_templates"]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [showRateCard, setShowRateCard] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const loadMenuRef = useRef<HTMLDivElement>(null);
  const rateCardRef = useRef<HTMLDivElement>(null);

  // ── AI Scope Writer state ──────────────────────────────────────────────────
  const [showAIScope, setShowAIScope] = useState(false);
  const [scopeBrief, setScopeBrief] = useState("");
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeTitle, setScopeTitle] = useState("");
  const [scopeDescription, setScopeDescription] = useState("");
  const [scopeSOW, setScopeSOW] = useState("");
  const scopeGenerated = !!(scopeTitle || scopeDescription || scopeSOW);

  // ── Fetch on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getRateCardItems(),
      getQuoteEstimates(),
      getProjects(),
      getProfile(),
      getQuotes(),
      getMyCrewProfiles(),
    ]).then(([rc, est, proj, prof, q, crew]) => {
      setRateCardItems(rc);
      setSavedEstimates(est);
      setProjects(proj);
      setProfile(prof);
      setQuotes(q);
      setCrewProfiles(crew);
      if (prof?.quote_templates) setCustomTemplates(prof.quote_templates);
    }).catch(() => {});
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (loadMenuRef.current && !loadMenuRef.current.contains(e.target as Node))
        setShowLoadMenu(false);
      if (rateCardRef.current && !rateCardRef.current.contains(e.target as Node))
        setShowRateCard(false);
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
      newLine({ service: item.name, category: item.category, rate: item.default_rate, rateType: item.rate_type === "flat" ? "flat" : "day" }),
    ]);
  }

  function addFromCrew(member: CrewProfile) {
    setLineItems((prev) => [
      ...prev,
      newLine({
        service: `${member.name} — ${member.primary_role}`,
        category: "production",
        rate: member.day_rate_min ?? 0,
        rateType: "day" as const,
      }),
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
        toast.success("Estimate updated", {
          description: "Ready to send to a client?",
          action: { label: "Build Quote →", onClick: openAIScope },
        });
      } else {
        const created = await saveQuoteEstimate(payload);
        setSavedEstimates((prev) => [created, ...prev]);
        setCurrentEstimateId(created.id);
        toast.success("Estimate saved", {
          description: "Ready to send to a client?",
          action: { label: "Build Quote →", onClick: openAIScope },
        });
      }
    } catch {
      toast.error("Failed to save estimate");
    }
    setSaving(false);
  }

  function loadEstimate(est: QuoteEstimate) {
    setEstimateTitle(est.title);
    const normalized = est.line_items.map((li) => ({
      ...li,
      rateType: li.rateType ?? (li.isFlat ? "flat" : "day"),
    })) as CalcLineItem[];
    setLineItems(normalized.length ? normalized : [newLine()]);
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

  // ── Custom template save/delete ────────────────────────────────────────────
  async function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    try {
      const newTemplate = {
        id: Math.random().toString(36).slice(2),
        label: name,
        items: lineItems.filter((li) => li.service.trim()).map((li) => ({
          service: li.service, category: li.category, people: li.people,
          days: li.days, rate: li.rate, rateType: li.rateType,
        })),
      };
      const updated = [...(customTemplates ?? []), newTemplate];
      await updateProfile({ quote_templates: updated } as any);
      setCustomTemplates(updated);
      setTemplateName("");
      setShowSaveTemplate(false);
      toast.success("Template saved");
    } catch {
      toast.error("Failed to save template");
    }
    setSavingTemplate(false);
  }

  async function handleDeleteTemplate(id: string) {
    try {
      const updated = (customTemplates ?? []).filter((t) => t.id !== id);
      await updateProfile({ quote_templates: updated } as any);
      setCustomTemplates(updated);
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    }
  }

  // ── AI Scope Writer ────────────────────────────────────────────────────────
  async function handleGenerateScope() {
    if (!scopeBrief.trim()) return;
    setScopeLoading(true);
    try {
      const res = await fetch("/api/ai/quote-scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: scopeBrief,
          title: estimateTitle,
          lineItems: lineItems.filter((li) => li.service.trim()),
          selectedTier,
          tierAmount,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScopeTitle(data.title ?? "");
      setScopeDescription(data.description ?? "");
      setScopeSOW(data.scope_of_work ?? "");
    } catch {
      toast.error("AI generation failed — try again");
    }
    setScopeLoading(false);
  }

  function openAIScope() {
    setScopeTitle("");
    setScopeDescription("");
    setScopeSOW("");
    setShowAIScope(true);
  }

  // ── Build Quote prefill ────────────────────────────────────────────────────
  function buildQuotePrefill(): Partial<QuoteFormState> {
    const scale = costTotal > 0 ? tierMult * (1 + overheadPct / 100) : 1;
    const prefillItems: LineItemForm[] = lineItems
      .filter((li) => li.service.trim())
      .map((li) => ({
        id: Math.random().toString(36).slice(2),
        description: li.service,
        quantity: li.rateType === "flat" ? "1" : li.rateType === "unit" ? String(li.days) : String(li.people * li.days),
        rate: String(Math.round((li.rateType === "hour" ? li.rate * li.days * li.people : li.rate) * scale)),
      }));

    return {
      description: scopeDescription || (estimateTitle !== "Untitled Estimate" ? estimateTitle : ""),
      scope_of_work: scopeSOW || "",
      line_items: prefillItems.length ? prefillItems : undefined,
    };
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Quote Saved Banner ───────────────────────────────────────────── */}
      {quoteSaved && (
        <div className="shrink-0 mx-6 mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-400">Quote created</p>
                <p className="text-xs text-muted-foreground mt-0.5">What would you like to do next?</p>
              </div>
            </div>
            <button onClick={() => setQuoteSaved(false)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/finance?tab=quotes")}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              View in Finance
            </button>
            <button
              onClick={() => {
                const p = new URLSearchParams({ from: "quote", templateId: "production_agreement" });
                const projName = scopeTitle || (estimateTitle !== "Untitled Estimate" ? estimateTitle : "");
                if (projName) p.set("projectName", projName);
                if (tierAmount) p.set("totalFee", String(Math.round(tierAmount)));
                const delivsList = lineItems.map((li) => li.service).filter(Boolean).join(", ");
                if (delivsList) p.set("deliverables", delivsList.slice(0, 400));
                if (scopeDescription) p.set("projectDescription", scopeDescription.slice(0, 300));
                router.push(`/contracts?${p.toString()}`);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/[0.08] transition-colors"
            >
              Create Contract
            </button>
            <button
              onClick={() => router.push("/finance")}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/[0.08] transition-colors"
            >
              Create Invoice
            </button>
            <button
              onClick={() => { setQuoteSaved(false); newEstimate(); }}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-colors"
            >
              Start new estimate
            </button>
          </div>
        </div>
      )}

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

            {/* Project type templates */}
            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              <span className="text-[10px] text-muted-foreground/40 font-medium shrink-0">Templates:</span>
              <button
                onClick={() => setLineItems([newLine()])}
                className="shrink-0 rounded-full border border-border bg-muted/30 px-3 py-1 text-[11px] font-medium text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-all"
              >
                Blank
              </button>
              {PROJECT_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  onClick={() => setLineItems(tmpl.items.map((item) => newLine(item)))}
                  className="shrink-0 rounded-full border border-border bg-muted/30 px-3 py-1 text-[11px] font-medium text-muted-foreground hover:border-[#d4a853]/40 hover:bg-[#d4a853]/5 hover:text-[#d4a853] transition-all"
                >
                  {tmpl.label}
                </button>
              ))}
              {(customTemplates ?? []).map((tmpl) => (
                <div key={tmpl.id} className="group relative flex items-center">
                  <button
                    onClick={() => setLineItems(tmpl.items.map((item) => newLine(item as Partial<import("@/types").CalcLineItem>)))}
                    className="shrink-0 rounded-full border border-[#d4a853]/30 bg-[#d4a853]/5 px-3 py-1 text-[11px] font-medium text-[#d4a853] hover:bg-[#d4a853]/15 transition-all pr-6"
                  >
                    {tmpl.label}
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tmpl.id)}
                    className="absolute right-1.5 opacity-0 group-hover:opacity-100 text-[#d4a853]/50 hover:text-red-400 transition-all"
                    title="Delete template"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {/* Save current as template */}
              {showSaveTemplate ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); if (e.key === "Escape") setShowSaveTemplate(false); }}
                    placeholder="Template name…"
                    className="rounded-full border border-[#d4a853]/40 bg-background px-3 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none w-36"
                  />
                  <button onClick={handleSaveTemplate} disabled={savingTemplate || !templateName.trim()} className="flex items-center gap-1 text-[11px] text-[#d4a853] hover:text-[#c49843] disabled:opacity-40 transition-colors font-semibold">
                    <Check className="h-3 w-3" /> Save
                  </button>
                  <button onClick={() => setShowSaveTemplate(false)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setTemplateName(estimateTitle !== "Untitled Estimate" ? estimateTitle : ""); setShowSaveTemplate(true); }}
                  className="shrink-0 flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-[11px] font-medium text-muted-foreground/50 hover:border-[#d4a853]/40 hover:text-[#d4a853] transition-all"
                  title="Save current line items as a reusable template"
                >
                  <BookTemplate className="h-3 w-3" /> Save as Template
                </button>
              )}
            </div>

            {/* Line items table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_56px_56px_96px_80px_32px] gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
                {["Service", "People", "Days / Hrs", "Rate", "Total", ""].map((h) => (
                  <span key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center first:text-left last:text-right">
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <div className="divide-y divide-border/40">
                {lineItems.map((item) => {
                  const cfg = CALC_CATEGORY_CONFIG[item.category];
                  const rt = item.rateType ?? (item.isFlat ? "flat" : "day");
                  const total = lineTotal(item);
                  const RATE_CYCLE: Record<"day" | "hour" | "unit" | "flat", "day" | "hour" | "unit" | "flat"> = { day: "hour", hour: "unit", unit: "flat", flat: "day" };
                  return (
                    <div key={item.id} className="grid grid-cols-[1fr_56px_56px_96px_80px_32px] gap-2 px-4 py-2.5 items-center group hover:bg-muted/10 transition-colors">
                      {/* Service name + category dot + rate type badge */}
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => {
                            const idx = CATEGORIES.indexOf(item.category);
                            updateItem(item.id, "category", CATEGORIES[(idx + 1) % CATEGORIES.length]);
                          }}
                          title={cfg.label}
                          className={cn("h-2 w-2 shrink-0 rounded-full transition-transform hover:scale-125", cfg.dot)}
                        />
                        <button
                          onClick={() => updateItem(item.id, "rateType", RATE_CYCLE[rt])}
                          title="Click to change: Day Rate → Per Unit → Flat Fee"
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border transition-all hover:opacity-80",
                            rt === "day"  && "border-amber-500/25 bg-amber-500/8 text-amber-400/70",
                            rt === "hour" && "border-orange-500/25 bg-orange-500/8 text-orange-400/70",
                            rt === "unit" && "border-cyan-500/25 bg-cyan-500/8 text-cyan-400/70",
                            rt === "flat" && "border-zinc-500/25 bg-zinc-500/8 text-zinc-400/70",
                          )}
                        >
                          {rt === "day" ? "Day" : rt === "hour" ? "Hour" : rt === "unit" ? "Unit" : "Flat"}
                        </button>
                        <input
                          value={item.service}
                          onChange={(e) => updateItem(item.id, "service", e.target.value)}
                          placeholder={rt === "unit" ? "Deliverable (e.g. Edit per video)" : "Service or crew role"}
                          className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
                        />
                      </div>
                      {/* People — only for day/hour rate */}
                      {rt === "day" || rt === "hour" ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={String(item.people)}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "");
                            updateItem(item.id, "people", v === "" ? 0 : Number(v));
                          }}
                          className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-center font-mono text-foreground focus:border-border focus:bg-background focus:outline-none transition-colors"
                        />
                      ) : (
                        <span className="text-center text-muted-foreground/20 text-sm select-none">—</span>
                      )}
                      {/* Days / Qty — hidden for flat */}
                      {rt === "flat" ? (
                        <span className="text-center text-muted-foreground/20 text-sm select-none">—</span>
                      ) : (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={String(item.days)}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "");
                            updateItem(item.id, "days", v === "" ? 0 : Number(v));
                          }}
                          placeholder={rt === "unit" ? "qty" : rt === "hour" ? "hrs" : ""}
                          className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-center font-mono text-foreground focus:border-border focus:bg-background focus:outline-none transition-colors placeholder:text-muted-foreground/30"
                        />
                      )}
                      {/* Rate */}
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.rate === 0 ? "" : String(item.rate)}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d.]/g, "");
                            updateItem(item.id, "rate", v === "" ? 0 : Number(v));
                          }}
                          placeholder="0"
                          className="w-full rounded-md border border-transparent bg-transparent pl-5 pr-1.5 py-1 text-sm font-mono text-foreground text-right focus:border-border focus:bg-background focus:outline-none transition-colors"
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
              <div className="relative" ref={rateCardRef}>
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
                    crew={crewProfiles}
                    onSelect={(item) => { addFromRateCard(item); setShowRateCard(false); }}
                    onSelectCrew={(member) => { addFromCrew(member); setShowRateCard(false); }}
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
                    type="text"
                    inputMode="numeric"
                    value={overheadPct === 0 ? "" : String(overheadPct)}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      setOverheadPct(v === "" ? 0 : Math.min(100, Number(v)));
                    }}
                    placeholder="0"
                    className="w-10 bg-transparent text-sm font-mono text-foreground text-center focus:outline-none"
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
              onBuildQuote={openAIScope}
            />
            <TierCard
              label="Standard"
              sublabel="Your typical rate"
              amount={standard}
              multiplier={stdMult}
              selected={selectedTier === "standard"}
              onSelect={() => setSelectedTier("standard")}
              onMultChange={setStdMult}
              onBuildQuote={openAIScope}
            />
            <TierCard
              label="Premium"
              sublabel="Rush jobs / premium clients"
              amount={premium}
              multiplier={premiumMult}
              selected={selectedTier === "premium"}
              onSelect={() => setSelectedTier("premium")}
              onMultChange={setPremiumMult}
              onBuildQuote={openAIScope}
            />

            <p className="text-[9px] text-muted-foreground/30 text-center">
              Click ×N on any tier to edit its multiplier
            </p>

            {/* AI Scope Writer panel */}
            {showAIScope && (
              <div className="rounded-xl border border-[#d4a853]/25 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[#d4a853]" />
                    <p className="text-xs font-bold text-foreground">AI Scope Writer</p>
                  </div>
                  <button
                    onClick={() => setShowAIScope(false)}
                    className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    value={scopeBrief}
                    onChange={(e) => setScopeBrief(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !scopeLoading && handleGenerateScope()}
                    placeholder="Describe the project in one line…"
                    className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[#d4a853]/50 transition-colors"
                  />
                  <button
                    onClick={handleGenerateScope}
                    disabled={scopeLoading || !scopeBrief.trim()}
                    className="flex items-center gap-1.5 shrink-0 rounded-lg bg-[#d4a853]/10 border border-[#d4a853]/20 px-2.5 py-1.5 text-xs font-semibold text-[#d4a853] hover:bg-[#d4a853]/20 disabled:opacity-40 transition-all"
                  >
                    {scopeLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5" />
                    }
                    {scopeLoading ? "Writing…" : "Generate"}
                  </button>
                </div>

                {scopeGenerated && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Quote Title</label>
                      <input
                        value={scopeTitle}
                        onChange={(e) => setScopeTitle(e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-[#d4a853]/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Description</label>
                      <input
                        value={scopeDescription}
                        onChange={(e) => setScopeDescription(e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-[#d4a853]/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Scope of Work</label>
                      <textarea
                        value={scopeSOW}
                        onChange={(e) => setScopeSOW(e.target.value)}
                        rows={3}
                        className="mt-0.5 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-[#d4a853]/50 transition-colors resize-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={() => { setShowAIScope(false); setShowQuoteModal(true); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => { setShowAIScope(false); setShowQuoteModal(true); }}
                    className="flex-1 rounded-lg bg-[#d4a853] py-2 text-xs font-bold text-black hover:bg-[#c49843] transition-all active:scale-[0.98]"
                  >
                    Build Quote →
                  </button>
                </div>
              </div>
            )}

            {/* Summary */}
            {subtotal > 0 && !showAIScope && (
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
        onSave={async (f: QuoteFormState) => {
          try {
            const lineItems: LineItem[] = f.line_items
              .filter((li) => li.description.trim())
              .map((li) => ({ id: li.id, description: li.description, quantity: parseFloat(li.quantity) || 1, rate: parseFloat(li.rate) || 0 }));
            const packages: QuotePackage[] = f.packages.map((pkg) => {
              const pkgItems: LineItem[] = pkg.line_items
                .filter((li) => li.description.trim())
                .map((li) => ({ id: li.id, description: li.description, quantity: parseFloat(li.quantity) || 1, rate: parseFloat(li.rate) || 0 }));
              return { id: pkg.id, name: pkg.name, description: pkg.description || undefined, line_items: pkgItems, amount: pkgItems.reduce((s, li) => s + li.quantity * li.rate, 0), highlighted: pkg.highlighted };
            });
            const retainerDeliverables: RetainerTemplateItem[] = f.retainer_deliverables
              .filter((d) => d.label.trim())
              .map((d) => ({ type: d.type, label: d.label, quantity: parseInt(d.quantity) || 1 }));
            const subtotal = f.use_packages ? 0 : lineItems.reduce((s, li) => s + li.quantity * li.rate, 0);
            const discount = parseFloat(f.discount) || 0;
            const taxRate = parseFloat(f.tax_rate) || 0;
            const amount = f.quote_type === "retainer"
              ? (parseFloat(f.monthly_rate) || 0) * (parseInt(f.retainer_months) || 1)
              : f.use_packages ? 0 : subtotal - discount + (subtotal - discount) * (taxRate / 100);
            await createQuote({
              quote_number: f.quote_number,
              quote_type: f.quote_type,
              client_name: f.client_name,
              client_email: f.client_email || undefined,
              project_id: f.project_id || undefined,
              description: f.description || undefined,
              scope_of_work: f.scope_of_work || undefined,
              line_items: f.use_packages ? [] : lineItems,
              packages: f.use_packages ? packages : [],
              tax_rate: taxRate,
              discount,
              payment_terms: f.payment_terms,
              valid_until: f.valid_until || undefined,
              notes: f.notes || undefined,
              monthly_rate: f.quote_type === "retainer" ? parseFloat(f.monthly_rate) || undefined : undefined,
              retainer_months: f.quote_type === "retainer" ? parseInt(f.retainer_months) || undefined : undefined,
              retainer_deliverables: f.quote_type === "retainer" ? retainerDeliverables : undefined,
              amount,
              status: "draft" as const,
              brand_logo_url: profile?.logo_url ?? undefined,
              brand_name: profile?.business_name ?? undefined,
              brand_color: profile?.brand_color ?? undefined,
            });
            setShowQuoteModal(false);
            setQuoteSaved(true);
          } catch {
            toast.error("Failed to save quote");
          }
        }}
        initial={buildQuotePrefill()}
        packageBrief={scopeBrief}
        projects={projects}
        profile={profile}
        quotes={quotes}
      />
    </div>
  );
}
