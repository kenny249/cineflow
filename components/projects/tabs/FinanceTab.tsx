"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, DollarSign, Lock, TrendingUp, TrendingDown, Minus, Edit3, Check, X } from "lucide-react";
import { getBudgetLines, createBudgetLine, updateBudgetLine, deleteBudgetLine } from "@/lib/supabase/queries";
import type { BudgetLine } from "@/types";
import { toast } from "sonner";

interface FinanceTabProps {
  projectId: string;
  isAdmin: boolean;
}

const CATEGORIES = ["Pre-Production", "Crew", "Cast", "Equipment", "Location", "Travel & Lodging", "Catering", "Post-Production", "Music & SFX", "Marketing", "Insurance", "Miscellaneous"];

interface LineForm {
  category: string;
  description: string;
  budgeted: string;
  actual: string;
  vendor: string;
  notes: string;
}

const EMPTY_FORM: LineForm = { category: "Crew", description: "", budgeted: "", actual: "", vendor: "", notes: "" };

function fmt(n?: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function groupByCategory(lines: BudgetLine[]): Record<string, BudgetLine[]> {
  return lines.reduce<Record<string, BudgetLine[]>>((acc, l) => {
    if (!acc[l.category]) acc[l.category] = [];
    acc[l.category].push(l);
    return acc;
  }, {});
}

export function FinanceTab({ projectId, isAdmin }: FinanceTabProps) {
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LineForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    getBudgetLines(projectId).then(setLines).catch(() => {}).finally(() => setLoading(false));
  }, [projectId, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/40">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-display text-lg font-bold text-foreground">Admin access only</p>
        <p className="text-sm text-muted-foreground">Budget and financial information is restricted to project admins.</p>
      </div>
    );
  }

  const totalBudgeted = lines.reduce((s, l) => s + (l.budgeted ?? 0), 0);
  const totalActual   = lines.reduce((s, l) => s + (l.actual ?? 0), 0);
  const delta = totalActual - totalBudgeted;

  async function handleSave() {
    if (!form.description.trim()) { toast.error("Description is required"); return; }
    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        category: form.category,
        description: form.description,
        budgeted: parseFloat(form.budgeted) || 0,
        actual: form.actual !== "" ? parseFloat(form.actual) : undefined,
        vendor: form.vendor || undefined,
        notes: form.notes || undefined,
        sort_order: lines.length,
      };
      if (editingId) {
        const updated = await updateBudgetLine(editingId, payload);
        setLines((prev) => prev.map((l) => l.id === editingId ? updated : l));
        toast.success("Line updated");
      } else {
        const created = await createBudgetLine(payload);
        setLines((prev) => [...prev, created]);
        toast.success("Budget line added");
      }
      setShowAdd(false); setEditingId(null); setForm(EMPTY_FORM);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteBudgetLine(id);
      setLines((prev) => prev.filter((l) => l.id !== id));
      toast.success("Removed");
    } catch { toast.error("Failed to delete"); }
    finally { setDeletingId(null); }
  }

  function startEdit(line: BudgetLine) {
    setForm({ category: line.category, description: line.description, budgeted: String(line.budgeted ?? ""), actual: line.actual != null ? String(line.actual) : "", vendor: line.vendor ?? "", notes: line.notes ?? "" });
    setEditingId(line.id); setShowAdd(true);
  }

  const grouped = groupByCategory(lines);
  const cats = Object.keys(grouped).sort();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Summary bar */}
      <div className="shrink-0 border-b border-border px-4 sm:px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Budget</p>
            <p className="text-lg font-display font-bold text-foreground">{fmt(totalBudgeted)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actual Spend</p>
            <p className="text-lg font-display font-bold text-foreground">{fmt(totalActual)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Variance</p>
            <p className={`flex items-center gap-1 text-lg font-display font-bold ${delta > 0 ? "text-red-400" : delta < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
              {delta > 0 ? <TrendingUp className="h-4 w-4" /> : delta < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              {fmt(Math.abs(delta))} {delta > 0 ? "over" : delta < 0 ? "under" : ""}
            </p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => { setShowAdd(true); setEditingId(null); setForm(EMPTY_FORM); }}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <div className="shrink-0 border-b border-border bg-muted/10 px-4 sm:px-5 py-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{editingId ? "Edit Line" : "New Budget Line"}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <select className="budget-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="budget-input sm:col-span-2" placeholder="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <input className="budget-input pl-5" placeholder="Budgeted" type="number" step="0.01" value={form.budgeted} onChange={(e) => setForm({ ...form, budgeted: e.target.value })} />
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <input className="budget-input pl-5" placeholder="Actual" type="number" step="0.01" value={form.actual} onChange={(e) => setForm({ ...form, actual: e.target.value })} />
            </div>
            <input className="budget-input" placeholder="Vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            <input className="budget-input col-span-2 sm:col-span-3" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-60">
              {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-5 py-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <DollarSign className="mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="font-display font-semibold">No budget lines yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Track budgeted vs actual spend across categories</p>
          </div>
        ) : (
          cats.map((cat) => {
            const catBudget = grouped[cat].reduce((s, l) => s + (l.budgeted ?? 0), 0);
            const catActual = grouped[cat].reduce((s, l) => s + (l.actual ?? 0), 0);
            return (
              <div key={cat}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{cat}</p>
                  <p className="text-xs text-muted-foreground">{fmt(catBudget)} budgeted · {fmt(catActual)} actual</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-border">
                  {/* Header row — hidden on mobile */}
                  <div className="hidden sm:grid grid-cols-5 gap-2 border-b border-border bg-muted/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="col-span-2">Description</span>
                    <span className="text-right">Budgeted</span>
                    <span className="text-right">Actual</span>
                    <span className="text-right">Variance</span>
                  </div>
                  {grouped[cat].map((line, idx) => {
                    const lineActual = line.actual ?? 0;
                    const lineDelta = lineActual - line.budgeted;
                    return (
                      <div key={line.id} className={`group flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-5 sm:items-center sm:gap-2 transition-colors hover:bg-muted/10 ${idx > 0 ? "border-t border-border" : ""}`}>
                        <div className="col-span-2 min-w-0">
                          <p className="truncate text-sm text-foreground">{line.description}</p>
                          {line.vendor && <p className="text-xs text-muted-foreground">{line.vendor}</p>}
                        </div>
                        <p className="text-right text-sm text-foreground">
                          <span className="mr-2 inline text-xs text-muted-foreground sm:hidden">Budgeted:</span>
                          {fmt(line.budgeted)}
                        </p>
                        <p className="text-right text-sm text-foreground">
                          <span className="mr-2 inline text-xs text-muted-foreground sm:hidden">Actual:</span>
                          {line.actual != null ? fmt(line.actual) : "—"}
                        </p>
                        <div className="flex items-center justify-end gap-2">
                          <p className={`text-right text-sm ${lineDelta > 0 ? "text-red-400" : "text-emerald-400"}`}>
                            <span className="mr-2 inline text-xs text-muted-foreground sm:hidden">Variance:</span>
                            {line.actual != null ? fmt(Math.abs(lineDelta)) : "—"}
                          </p>
                          <div className="flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <button onClick={() => startEdit(line)} className="rounded p-1 text-muted-foreground hover:text-foreground"><Edit3 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleDelete(line.id)} disabled={deletingId === line.id} className="rounded p-1 text-muted-foreground hover:text-red-400">
                              {deletingId === line.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/30 border-t-muted-foreground" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        .budget-input { width: 100%; border-radius: 0.5rem; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); padding: 0.375rem 0.75rem; font-size: 0.875rem; color: hsl(var(--foreground)); outline: none; }
        .budget-input:focus { border-color: rgba(212,168,83,0.5); box-shadow: 0 0 0 1px rgba(212,168,83,0.3); }
        .budget-input::placeholder { color: hsl(var(--muted-foreground)); }
        select.budget-input option { background: hsl(var(--background)); color: hsl(var(--foreground)); }
      `}</style>
    </div>
  );
}
