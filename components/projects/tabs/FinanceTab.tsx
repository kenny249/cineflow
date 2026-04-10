"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Trash2, DollarSign, TrendingUp, TrendingDown, Minus, Edit3, Check, X, Receipt, AlertCircle, Clock, CheckCircle2, FileText, Send, ChevronDown, ChevronUp } from "lucide-react";
import { getBudgetLines, createBudgetLine, updateBudgetLine, deleteBudgetLine, getInvoicesByProject, createInvoice, updateInvoice, deleteInvoice } from "@/lib/supabase/queries";
import type { BudgetLine, Invoice, InvoiceStatus } from "@/types";
import { toast } from "sonner";

interface FinanceTabProps {
  projectId: string;
  isAdmin: boolean;
}

const CATEGORIES = ["Pre-Production", "Crew", "Cast", "Equipment", "Location", "Travel & Lodging", "Catering", "Post-Production", "Music & SFX", "Marketing", "Insurance", "Miscellaneous"];

const STATUS_META: Record<InvoiceStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft:   { label: "Draft",   color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",         icon: FileText },
  sent:    { label: "Sent",    color: "bg-blue-500/15 text-blue-400 border-blue-500/20",          icon: Send },
  partial: { label: "Partial", color: "bg-amber-500/15 text-amber-400 border-amber-500/20",       icon: Clock },
  paid:    { label: "Paid",    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  overdue: { label: "Overdue", color: "bg-red-500/15 text-red-400 border-red-500/20",             icon: AlertCircle },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.color}`}>
      <Icon className="h-2.5 w-2.5" />{m.label}
    </span>
  );
}

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

interface LineForm { category: string; description: string; budgeted: string; actual: string; vendor: string; notes: string; }
const EMPTY_LINE: LineForm = { category: "Crew", description: "", budgeted: "", actual: "", vendor: "", notes: "" };

interface InvForm { invoice_number: string; client_name: string; description: string; amount: string; amount_paid: string; status: InvoiceStatus; due_date: string; paid_date: string; notes: string; }
const EMPTY_INV: InvForm = { invoice_number: "", client_name: "", description: "", amount: "", amount_paid: "0", status: "draft", due_date: "", paid_date: "", notes: "" };

export function FinanceTab({ projectId, isAdmin }: FinanceTabProps) {
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"budget" | "invoices">("budget");

  // Budget line form state
  const [showAddLine, setShowAddLine] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState<LineForm>(EMPTY_LINE);
  const [savingLine, setSavingLine] = useState(false);
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null);

  // Invoice form state
  const [showInvForm, setShowInvForm] = useState(false);
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [invForm, setInvForm] = useState<InvForm>(EMPTY_INV);
  const [savingInv, setSavingInv] = useState(false);
  const [deletingInvId, setDeletingInvId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getBudgetLines(projectId).catch(() => [] as BudgetLine[]),
      getInvoicesByProject(projectId).catch(() => [] as Invoice[]),
    ]).then(([bl, inv]) => { setLines(bl); setInvoices(inv); }).finally(() => setLoading(false));
  }, [projectId]);

  // ── Summary numbers ──
  const totalBudgeted = lines.reduce((s, l) => s + (l.budgeted ?? 0), 0);
  const totalActual   = lines.reduce((s, l) => s + (l.actual ?? 0), 0);
  const delta = totalActual - totalBudgeted;
  const totalInvoiced  = invoices.reduce((s, i) => s + i.amount, 0);
  const totalCollected = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const profit = totalCollected - totalActual;

  // ── Budget line CRUD ──
  async function handleSaveLine() {
    if (!lineForm.description.trim()) { toast.error("Description is required"); return; }
    setSavingLine(true);
    try {
      const payload = { project_id: projectId, category: lineForm.category, description: lineForm.description, budgeted: parseFloat(lineForm.budgeted) || 0, actual: lineForm.actual !== "" ? parseFloat(lineForm.actual) : undefined, vendor: lineForm.vendor || undefined, notes: lineForm.notes || undefined, sort_order: lines.length };
      if (editingLineId) {
        const updated = await updateBudgetLine(editingLineId, payload);
        setLines((p) => p.map((l) => l.id === editingLineId ? updated : l));
        toast.success("Line updated");
      } else {
        const created = await createBudgetLine(payload);
        setLines((p) => [...p, created]);
        toast.success("Budget line added");
      }
      setShowAddLine(false); setEditingLineId(null); setLineForm(EMPTY_LINE);
    } catch { toast.error("Failed to save"); } finally { setSavingLine(false); }
  }
  async function handleDeleteLine(id: string) {
    setDeletingLineId(id);
    try { await deleteBudgetLine(id); setLines((p) => p.filter((l) => l.id !== id)); toast.success("Removed"); }
    catch { toast.error("Failed to delete"); } finally { setDeletingLineId(null); }
  }
  function startEditLine(line: BudgetLine) {
    setLineForm({ category: line.category, description: line.description, budgeted: String(line.budgeted ?? ""), actual: line.actual != null ? String(line.actual) : "", vendor: line.vendor ?? "", notes: line.notes ?? "" });
    setEditingLineId(line.id); setShowAddLine(true);
  }

  // ── Invoice CRUD ──
  function nextInvNumber() {
    const nums = invoices.map((i) => parseInt(i.invoice_number.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    return `INV-${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(4, "0")}`;
  }
  async function handleSaveInv() {
    if (!invForm.invoice_number.trim()) { toast.error("Invoice number required"); return; }
    const amount = parseFloat(invForm.amount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setSavingInv(true);
    try {
      const payload = { project_id: projectId, invoice_number: invForm.invoice_number.trim(), client_name: invForm.client_name.trim() || undefined, description: invForm.description.trim() || undefined, amount, amount_paid: parseFloat(invForm.amount_paid) || 0, status: invForm.status, due_date: invForm.due_date || undefined, paid_date: invForm.paid_date || undefined, notes: invForm.notes.trim() || undefined };
      if (editingInvId) {
        const updated = await updateInvoice(editingInvId, payload);
        setInvoices((p) => p.map((i) => i.id === editingInvId ? updated : i));
        toast.success("Invoice updated");
      } else {
        const created = await createInvoice(payload as Parameters<typeof createInvoice>[0]);
        setInvoices((p) => [created, ...p]);
        toast.success("Invoice created");
      }
      setShowInvForm(false); setEditingInvId(null); setInvForm(EMPTY_INV);
    } catch { toast.error("Failed to save invoice"); } finally { setSavingInv(false); }
  }
  async function handleDeleteInv(id: string) {
    setDeletingInvId(id);
    try { await deleteInvoice(id); setInvoices((p) => p.filter((i) => i.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Failed to delete"); } finally { setDeletingInvId(null); }
  }
  async function quickStatus(inv: Invoice, status: InvoiceStatus) {
    const updates: Partial<Invoice> = { status };
    if (status === "paid") { updates.amount_paid = inv.amount; updates.paid_date = new Date().toISOString().split("T")[0]; }
    try { const updated = await updateInvoice(inv.id, updates); setInvoices((p) => p.map((i) => i.id === inv.id ? updated : i)); toast.success(`Marked as ${status}`); }
    catch { toast.error("Failed to update"); }
  }

  const fi = (k: keyof InvForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setInvForm((p) => ({ ...p, [k]: e.target.value }));
  const grouped = groupByCategory(lines);
  const cats = Object.keys(grouped).sort();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Summary bar ── */}
      <div className="shrink-0 border-b border-border px-4 sm:px-5 py-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-3">
          {[
            { label: "Invoiced",   value: fmt(totalInvoiced),  color: "text-foreground" },
            { label: "Collected",  value: fmt(totalCollected), color: "text-emerald-400" },
            { label: "Expenses",   value: fmt(totalActual),    color: "text-red-400" },
            { label: "Net Profit", value: fmt(profit),         color: profit >= 0 ? "text-emerald-400" : "text-red-400" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className={`font-display text-base font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
        {/* Section tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["budget", "invoices"] as const).map((t) => (
            <button key={t} onClick={() => setActiveSection(t)} className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${activeSection === t ? "border-[#d4a853] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "budget" ? `Budget (${lines.length})` : `Invoices (${invoices.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Budget section ── */}
      {activeSection === "budget" && (
        <>
          {showAddLine && (
            <div className="shrink-0 border-b border-border bg-muted/10 px-4 sm:px-5 py-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{editingLineId ? "Edit Line" : "New Budget Line"}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <select className="budget-input" value={lineForm.category} onChange={(e) => setLineForm({ ...lineForm, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input className="budget-input sm:col-span-2" placeholder="Description *" value={lineForm.description} onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })} />
                <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span><input className="budget-input pl-5" placeholder="Budgeted" type="number" step="0.01" value={lineForm.budgeted} onChange={(e) => setLineForm({ ...lineForm, budgeted: e.target.value })} /></div>
                <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span><input className="budget-input pl-5" placeholder="Actual" type="number" step="0.01" value={lineForm.actual} onChange={(e) => setLineForm({ ...lineForm, actual: e.target.value })} /></div>
                <input className="budget-input" placeholder="Vendor" value={lineForm.vendor} onChange={(e) => setLineForm({ ...lineForm, vendor: e.target.value })} />
                <input className="budget-input col-span-2 sm:col-span-3" placeholder="Notes" value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => { setShowAddLine(false); setEditingLineId(null); }} className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={handleSaveLine} disabled={savingLine} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-60">
                  {savingLine ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-3.5 w-3.5" />}Save
                </button>
              </div>
            </div>
          )}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 sm:px-5 py-2.5">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Budget: {fmt(totalBudgeted)}</span>
              <span className={delta > 0 ? "text-red-400" : "text-emerald-400"}>{delta > 0 ? `+${fmt(delta)} over` : delta < 0 ? `${fmt(Math.abs(delta))} under` : "on track"}</span>
            </div>
            <button onClick={() => { setShowAddLine(true); setEditingLineId(null); setLineForm(EMPTY_LINE); }} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors">
              <Plus className="h-3.5 w-3.5" />Add line
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-5 py-4 space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-16"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" /></div>
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
                      <div className="hidden sm:grid grid-cols-5 gap-2 border-b border-border bg-muted/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span className="col-span-2">Description</span><span className="text-right">Budgeted</span><span className="text-right">Actual</span><span className="text-right">Variance</span>
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
                            <p className="text-right text-sm text-foreground"><span className="mr-2 inline text-xs text-muted-foreground sm:hidden">Budgeted:</span>{fmt(line.budgeted)}</p>
                            <p className="text-right text-sm text-foreground"><span className="mr-2 inline text-xs text-muted-foreground sm:hidden">Actual:</span>{line.actual != null ? fmt(line.actual) : "—"}</p>
                            <div className="flex items-center justify-end gap-2">
                              <p className={`text-right text-sm ${lineDelta > 0 ? "text-red-400" : "text-emerald-400"}`}><span className="mr-2 inline text-xs text-muted-foreground sm:hidden">Variance:</span>{line.actual != null ? fmt(Math.abs(lineDelta)) : "—"}</p>
                              <div className="flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                                <button onClick={() => startEditLine(line)} className="rounded p-1 text-muted-foreground hover:text-foreground"><Edit3 className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleDeleteLine(line.id)} disabled={deletingLineId === line.id} className="rounded p-1 text-muted-foreground hover:text-red-400">
                                  {deletingLineId === line.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/30 border-t-muted-foreground" /> : <Trash2 className="h-3.5 w-3.5" />}
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
        </>
      )}

      {/* ── Invoices section ── */}
      {activeSection === "invoices" && (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 sm:px-5 py-2.5">
            <p className="text-xs text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} · {fmt(totalInvoiced)} invoiced · {fmt(totalCollected)} collected</p>
            <button onClick={() => { setInvForm({ ...EMPTY_INV, invoice_number: nextInvNumber() }); setEditingInvId(null); setShowInvForm(true); }} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors">
              <Plus className="h-3.5 w-3.5" />New Invoice
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-5 py-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-16"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" /></div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Receipt className="mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="font-display font-semibold">No invoices yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Track what you've invoiced and been paid for this project</p>
              </div>
            ) : (
              invoices.map((inv) => <ProjectInvoiceRow key={inv.id} inv={inv} onEdit={(i) => { setInvForm({ invoice_number: i.invoice_number, client_name: i.client_name ?? "", description: i.description ?? "", amount: String(i.amount), amount_paid: String(i.amount_paid), status: i.status, due_date: i.due_date ?? "", paid_date: i.paid_date ?? "", notes: i.notes ?? "" }); setEditingInvId(i.id); setShowInvForm(true); }} onDelete={handleDeleteInv} onQuickStatus={quickStatus} deletingId={deletingInvId} />)
            )}
          </div>
        </>
      )}

      {/* ── Invoice Form Modal ── */}
      {showInvForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInvForm(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display font-semibold text-foreground">{editingInvId ? "Edit Invoice" : "New Invoice"}</h2>
              <button onClick={() => setShowInvForm(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="fin-label">Invoice #</label><input className="fin-input" value={invForm.invoice_number} onChange={fi("invoice_number")} placeholder="INV-0001" /></div>
                <div><label className="fin-label">Status</label>
                  <select className="fin-input" value={invForm.status} onChange={fi("status")}>
                    {(Object.keys(STATUS_META) as InvoiceStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="fin-label">Client Name</label><input className="fin-input" value={invForm.client_name} onChange={fi("client_name")} placeholder="Client name" /></div>
              <div><label className="fin-label">Description</label><input className="fin-input" value={invForm.description} onChange={fi("description")} placeholder="e.g. Brand film production" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="fin-label">Amount ($)</label><input className="fin-input" type="number" min="0" step="0.01" value={invForm.amount} onChange={fi("amount")} placeholder="0.00" /></div>
                <div><label className="fin-label">Paid ($)</label><input className="fin-input" type="number" min="0" step="0.01" value={invForm.amount_paid} onChange={fi("amount_paid")} placeholder="0.00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="fin-label">Due Date</label><input className="fin-input" type="date" value={invForm.due_date} onChange={fi("due_date")} /></div>
                <div><label className="fin-label">Paid Date</label><input className="fin-input" type="date" value={invForm.paid_date} onChange={fi("paid_date")} /></div>
              </div>
              <div><label className="fin-label">Notes</label><textarea className="fin-input resize-none" rows={2} value={invForm.notes} onChange={fi("notes")} placeholder="Internal notes…" /></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => setShowInvForm(false)} className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted/20">Cancel</button>
              <button onClick={handleSaveInv} disabled={savingInv} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-60">
                {savingInv ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-3.5 w-3.5" />}
                {editingInvId ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .budget-input,.fin-input { width:100%; border-radius:0.5rem; border:1px solid hsl(var(--border)); background:hsl(var(--background)); padding:0.375rem 0.75rem; font-size:0.875rem; color:hsl(var(--foreground)); outline:none; }
        .budget-input:focus,.fin-input:focus { border-color:rgba(212,168,83,0.5); box-shadow:0 0 0 1px rgba(212,168,83,0.3); }
        .budget-input::placeholder,.fin-input::placeholder { color:hsl(var(--muted-foreground)); }
        select.budget-input option,select.fin-input option { background:hsl(var(--background)); color:hsl(var(--foreground)); }
        .fin-label { display:block; margin-bottom:0.25rem; font-size:0.625rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:hsl(var(--muted-foreground)); }
      `}</style>
    </div>
  );
}

// ─── Project Invoice Row (compact) ──────────────────────────────────────────

function ProjectInvoiceRow({ inv, onEdit, onDelete, onQuickStatus, deletingId }: {
  inv: Invoice;
  onEdit: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  onQuickStatus: (inv: Invoice, s: InvoiceStatus) => void;
  deletingId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const outstanding = inv.amount - inv.amount_paid;
  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      <div className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors" onClick={() => setOpen((p) => !p)}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground">{inv.invoice_number}</span>
            <StatusBadge status={inv.status} />
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">{inv.client_name || inv.description || "—"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">{inv.amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</p>
          {outstanding > 0 && inv.status !== "paid" && <p className="text-[10px] text-amber-400">{outstanding.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} due</p>}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </div>
      {open && (
        <div className="border-t border-border bg-muted/5 px-4 py-3 space-y-2">
          {inv.notes && <p className="text-xs text-muted-foreground/60 italic">{inv.notes}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {inv.status !== "paid" && <button onClick={() => onQuickStatus(inv, "paid")} className="flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20"><CheckCircle2 className="h-3 w-3" />Mark Paid</button>}
            {inv.status === "draft" && <button onClick={() => onQuickStatus(inv, "sent")} className="flex items-center gap-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[10px] font-semibold text-blue-400 hover:bg-blue-500/20"><Send className="h-3 w-3" />Mark Sent</button>}
            <div className="ml-auto flex gap-1">
              <button onClick={() => onEdit(inv)} className="rounded p-1.5 text-muted-foreground hover:text-foreground"><Edit3 className="h-3.5 w-3.5" /></button>
              <button onClick={() => onDelete(inv.id)} disabled={deletingId === inv.id} className="rounded p-1.5 text-muted-foreground hover:text-red-400">
                {deletingId === inv.id ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/30 border-t-muted-foreground" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

