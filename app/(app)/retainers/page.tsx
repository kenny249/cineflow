"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Repeat2, Plus, ArrowRight, CheckCircle2, Camera, Sparkles,
  ChevronRight, DollarSign, X, AlertCircle,
} from "lucide-react";
import { getRetainers, createRetainer, getRetainerMonths } from "@/lib/supabase/queries";
import type { Retainer, RetainerMonth, RetainerTemplateItem } from "@/types";
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

function nextMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const TYPE_PRESETS = [
  { type: "short",   label: "Short-form Videos" },
  { type: "photo",   label: "Photos" },
  { type: "premium", label: "Premium Piece" },
  { type: "reel",    label: "Reels" },
  { type: "story",   label: "Stories" },
  { type: "other",   label: "Other" },
];

// ── New retainer form ────────────────────────────────────────────────────────

const EMPTY_TEMPLATE: RetainerTemplateItem[] = [
  { type: "short",   label: "Short-form Videos", quantity: 12 },
  { type: "photo",   label: "Photos",            quantity: 20 },
  { type: "premium", label: "Premium Piece",      quantity: 1  },
];

function NewRetainerForm({ onCreated, onCancel }: { onCreated: (r: Retainer) => void; onCancel: () => void }) {
  const [clientName, setClientName] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [template, setTemplate] = useState<RetainerTemplateItem[]>(EMPTY_TEMPLATE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function updateTemplate(idx: number, field: keyof RetainerTemplateItem, value: string | number) {
    setTemplate(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function addTemplateRow() {
    setTemplate(prev => [...prev, { type: "other", label: "", quantity: 1 }]);
  }

  function removeTemplateRow(idx: number) {
    setTemplate(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!clientName.trim()) { toast.error("Client name is required"); return; }
    if (template.some(t => !t.label.trim())) { toast.error("All deliverable types need a label"); return; }
    setSaving(true);
    try {
      const r = await createRetainer({
        client_name: clientName.trim(),
        monthly_rate: monthlyRate ? Number(monthlyRate) : undefined,
        template: template.filter(t => t.quantity > 0),
        notes: notes.trim() || undefined,
        start_date: nextMonthYear() + "-01",
      });
      toast.success("Retainer created");
      onCreated(r);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create retainer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">New Retainer</h2>
          <button onClick={onCancel} className="text-white/40 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Client name */}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Client Name</label>
            <Input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="e.g. Nike"
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25"
            />
          </div>

          {/* Monthly rate */}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Monthly Rate (optional)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <Input
                type="number"
                value={monthlyRate}
                onChange={e => setMonthlyRate(e.target.value)}
                placeholder="5000"
                className="pl-8 bg-white/[0.04] border-white/10 text-white placeholder:text-white/25"
              />
            </div>
          </div>

          {/* Deliverable template */}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Monthly Deliverables</label>
            <div className="space-y-2">
              {template.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={item.label}
                    onChange={e => updateTemplate(idx, "label", e.target.value)}
                    placeholder="Deliverable label"
                    className="flex-1 bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 text-sm h-9"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateTemplate(idx, "quantity", parseInt(e.target.value) || 1)}
                    className="w-16 bg-white/[0.04] border-white/10 text-white text-center text-sm h-9"
                  />
                  <button
                    onClick={() => removeTemplateRow(idx)}
                    className="text-white/25 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={addTemplateRow}
                className="text-xs text-[#d4a853]/70 hover:text-[#d4a853] transition-colors flex items-center gap-1 mt-1"
              >
                <Plus className="h-3 w-3" /> Add deliverable type
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Scope notes, special requirements..."
              className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/25 resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onCancel} className="flex-1 border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-[#d4a853] text-black font-medium hover:bg-[#c49843]"
          >
            {saving ? "Creating…" : "Create Retainer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Retainer card ────────────────────────────────────────────────────────────

function RetainerCard({ retainer, latestMonth }: { retainer: Retainer; latestMonth?: RetainerMonth }) {
  const totalDeliverables = retainer.template.reduce((s, t) => s + t.quantity, 0);

  return (
    <Link
      href={`/retainers/${retainer.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 hover:border-[#d4a853]/20 hover:bg-white/[0.04] transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{retainer.client_name}</h3>
          {retainer.monthly_rate && (
            <p className="text-xs text-[#d4a853]/70 mt-0.5">
              ${retainer.monthly_rate.toLocaleString()}/mo
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "text-[10px] font-medium border",
              retainer.is_active
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
            )}
          >
            {retainer.is_active ? "Active" : "Inactive"}
          </Badge>
          <ChevronRight className="h-3.5 w-3.5 text-white/20 group-hover:text-[#d4a853]/50 transition-colors" />
        </div>
      </div>

      {/* Template summary */}
      <div className="flex flex-wrap gap-1.5">
        {retainer.template.map((item, i) => (
          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/50 border border-white/[0.06]">
            {item.quantity}× {item.label}
          </span>
        ))}
      </div>

      {/* Current month status */}
      {latestMonth ? (
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              latestMonth.status === "active" ? "bg-emerald-400" :
              latestMonth.status === "wrapped" ? "bg-blue-400" :
              latestMonth.status === "invoiced" ? "bg-violet-400" :
              "bg-white/30"
            )} />
            <span className="text-[11px] text-white/40">
              {formatMonthYear(latestMonth.month_year)} · {latestMonth.status}
            </span>
          </div>
          {latestMonth.shoot_date && (
            <span className="text-[11px] text-white/30">
              Shoot {new Date(latestMonth.shoot_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.05]">
          <AlertCircle className="h-3 w-3 text-white/20" />
          <span className="text-[11px] text-white/30">No months started yet</span>
        </div>
      )}
    </Link>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RetainersPage() {
  const [retainers, setRetainers] = useState<Retainer[]>([]);
  const [latestMonths, setLatestMonths] = useState<Record<string, RetainerMonth>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const rs = await getRetainers();
      setRetainers(rs);
      // Load the latest month for each retainer in parallel
      const monthMap: Record<string, RetainerMonth> = {};
      await Promise.all(rs.map(async (r) => {
        const months = await getRetainerMonths(r.id);
        if (months.length > 0) monthMap[r.id] = months[0]; // already desc order
      }));
      setLatestMonths(monthMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleCreated(r: Retainer) {
    setRetainers(prev => [r, ...prev]);
    setShowForm(false);
  }

  const active   = retainers.filter(r => r.is_active);
  const inactive = retainers.filter(r => !r.is_active);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d4a853]/20 bg-[#d4a853]/10">
            <Repeat2 className="h-4 w-4 text-[#d4a853]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Retainers</h1>
            <p className="text-xs text-white/40">Monthly client workflows</p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#d4a853] text-black font-medium hover:bg-[#c49843] h-8 text-sm"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Retainer
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853] border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && retainers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
            <Repeat2 className="h-6 w-6 text-white/20" />
          </div>
          <div>
            <p className="text-white/60 text-sm font-medium">No retainers yet</p>
            <p className="text-white/30 text-xs mt-1">Create your first retainer to start tracking monthly client work</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#d4a853] text-black font-medium hover:bg-[#c49843] mt-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Retainer
          </Button>
        </div>
      )}

      {/* Active retainers */}
      {!loading && active.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">Active</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map(r => (
              <RetainerCard key={r.id} retainer={r} latestMonth={latestMonths[r.id]} />
            ))}
          </div>
        </div>
      )}

      {/* Inactive retainers */}
      {!loading && inactive.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">Inactive</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {inactive.map(r => (
              <RetainerCard key={r.id} retainer={r} latestMonth={latestMonths[r.id]} />
            ))}
          </div>
        </div>
      )}

      {/* New retainer modal */}
      {showForm && (
        <NewRetainerForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
      )}
    </div>
  );
}
