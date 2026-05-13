"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { RateCardItem, CalcCategory } from "@/types";
import { getRateCardItems, createRateCardItem, updateRateCardItem, deleteRateCardItem } from "@/lib/supabase/queries";
import { CALC_CATEGORY_CONFIG } from "@/components/quote-calculator/QuoteCalculator";

const CATEGORIES = Object.keys(CALC_CATEGORY_CONFIG) as CalcCategory[];

const RATE_TYPES = [
  { value: "day" as const, label: "Per Day" },
  { value: "flat" as const, label: "Flat Fee" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

interface ItemRowProps {
  item: RateCardItem;
  onUpdate: (id: string, updates: Partial<RateCardItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function ItemRow({ item, onUpdate, onDelete }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<CalcCategory>(item.category as CalcCategory);
  const [rate, setRate] = useState(String(item.default_rate));
  const [rateType, setRateType] = useState<"day" | "flat">(item.rate_type);
  const [saving, setSaving] = useState(false);

  const cfg = CALC_CATEGORY_CONFIG[item.category as CalcCategory] ?? CALC_CATEGORY_CONFIG.other;

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdate(item.id, {
        name: name.trim() || item.name,
        category,
        default_rate: Math.max(0, parseFloat(rate) || 0),
        rate_type: rateType,
      });
      setEditing(false);
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  }

  function handleCancel() {
    setName(item.name);
    setCategory(item.category as CalcCategory);
    setRate(String(item.default_rate));
    setRateType(item.rate_type);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/20">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-[#d4a853]/50"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CalcCategory)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#d4a853]/50"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CALC_CATEGORY_CONFIG[c].label}</option>
          ))}
        </select>
        <div className="relative flex items-center">
          <span className="absolute left-2.5 text-xs text-muted-foreground/50">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
            className="w-24 rounded-lg border border-border bg-background pl-6 pr-2.5 py-1.5 text-sm font-mono text-foreground text-right focus:outline-none focus:border-[#d4a853]/50"
          />
        </div>
        <select
          value={rateType}
          onChange={(e) => setRateType(e.target.value as "day" | "flat")}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#d4a853]/50"
        >
          {RATE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button onClick={handleSave} disabled={saving} className="p-1.5 rounded-md bg-[#d4a853]/10 text-[#d4a853] hover:bg-[#d4a853]/20 transition-colors">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleCancel} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/10 transition-colors">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot)} />
      <span className="flex-1 text-sm text-foreground truncate">{item.name}</span>
      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0", cfg.bg, cfg.color)}>
        {cfg.label}
      </span>
      <span className="text-sm font-mono text-foreground/70 shrink-0">
        {fmt(item.default_rate)}{item.rate_type === "day" ? "/day" : " flat"}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="h-3 w-3" />
        </button>
        <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-400 transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddForm({ onAdd, onCancel }: { onAdd: (item: RateCardItem) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CalcCategory>("production");
  const [rate, setRate] = useState("");
  const [rateType, setRateType] = useState<"day" | "flat">("day");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const item = await createRateCardItem({
        name: name.trim(),
        category,
        default_rate: Math.max(0, parseFloat(rate) || 0),
        rate_type: rateType,
      });
      onAdd(item);
    } catch {
      toast.error("Failed to add service");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 bg-muted/20 border-t border-border">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">New Service</p>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Service name (e.g. DP / Camera Op)"
          className="flex-1 min-w-40 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[#d4a853]/50"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CalcCategory)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#d4a853]/50"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CALC_CATEGORY_CONFIG[c].label}</option>
          ))}
        </select>
        <div className="relative flex items-center">
          <span className="absolute left-2.5 text-xs text-muted-foreground/50">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            className="w-24 rounded-lg border border-border bg-background pl-6 pr-2.5 py-1.5 text-sm font-mono text-foreground text-right focus:outline-none focus:border-[#d4a853]/50"
          />
        </div>
        <select
          value={rateType}
          onChange={(e) => setRateType(e.target.value as "day" | "flat")}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#d4a853]/50"
        >
          {RATE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-40 transition-all"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? "Adding…" : "Add"}
        </button>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function RateCardSection() {
  const [items, setItems] = useState<RateCardItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRateCardItems()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleUpdate(id: string, updates: Partial<RateCardItem>) {
    const updated = await updateRateCardItem(id, updates);
    setItems((prev) => prev.map((i) => i.id === id ? updated : i));
    toast.success("Updated");
  }

  async function handleDelete(id: string) {
    await deleteRateCardItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Removed");
  }

  function handleAdd(item: RateCardItem) {
    setItems((prev) => [...prev, item]);
    setShowAdd(false);
    toast.success("Service added");
  }

  // Group by category
  const grouped = CATEGORIES.reduce<Record<CalcCategory, RateCardItem[]>>(
    (acc, cat) => ({ ...acc, [cat]: items.filter((i) => i.category === cat) }),
    {} as Record<CalcCategory, RateCardItem[]>
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Rate Card</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
            Default services and rates — pre-fill the Quote Calculator in one click
          </p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853]/10 border border-[#d4a853]/20 px-3 py-1.5 text-xs font-semibold text-[#d4a853] hover:bg-[#d4a853]/20 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Service
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-[#d4a853]" />
        </div>
      ) : items.length === 0 && !showAdd ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground/50">No services yet</p>
          <p className="text-xs text-muted-foreground/30 mt-1">Add your standard crew, equipment, and post services with day rates.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 flex items-center gap-1.5 mx-auto rounded-lg bg-[#d4a853] px-4 py-2 text-xs font-semibold text-black hover:bg-[#c49843] transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Add your first service
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {CATEGORIES.map((cat) => {
            const catItems = grouped[cat];
            if (!catItems.length) return null;
            const cfg = CALC_CATEGORY_CONFIG[cat];
            return (
              <div key={cat}>
                <p className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 bg-muted/10">
                  {cfg.label}
                </p>
                {catItems.map((item) => (
                  <ItemRow key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />}
    </div>
  );
}
