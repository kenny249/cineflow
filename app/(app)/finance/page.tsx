"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Trash2, Edit3,
  Check, X, ChevronDown, ChevronUp, ExternalLink, Receipt, Layers,
  AlertCircle, Clock, CheckCircle2, FileText, Send, Eye, GripVertical,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";
import {
  getInvoices, createInvoice, updateInvoice, deleteInvoice,
  getBudgetLines, getProjects, getProfile, createNotification,
  getQuotes,
} from "@/lib/supabase/queries";
import { InvoiceDocument } from "@/components/finance/InvoiceDocument";
import QuotesTab from "@/components/quotes/QuotesTab";
import type {
  Invoice, InvoiceStatus, BudgetLine, Project, Profile,
  PaymentTerms, PaymentInstallment, Quote,
} from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_META: Record<InvoiceStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft:   { label: "Draft",   color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",         icon: FileText },
  sent:    { label: "Sent",    color: "bg-blue-500/15 text-blue-400 border-blue-500/20",          icon: Send },
  partial: { label: "Partial", color: "bg-amber-500/15 text-amber-400 border-amber-500/20",       icon: Clock },
  paid:    { label: "Paid",    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  overdue: { label: "Overdue", color: "bg-red-500/15 text-red-400 border-red-500/20",             icon: AlertCircle },
};

const PAYMENT_TERMS: { value: PaymentTerms; label: string }[] = [
  { value: "due_on_receipt", label: "Due on Receipt" },
  { value: "net15",          label: "Net 15" },
  { value: "net30",          label: "Net 30" },
  { value: "net60",          label: "Net 60" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItemForm {
  id: string;
  description: string;
  quantity: string;
  rate: string;
}

interface InvoiceFormState {
  invoice_number: string;
  client_name: string;
  client_email: string;
  description: string;
  status: InvoiceStatus;
  invoice_date: string;
  due_date: string;
  paid_date: string;
  notes: string;
  project_id: string;
  line_items: LineItemForm[];
  tax_rate: string;
  payment_terms: PaymentTerms;
  use_payment_schedule: boolean;
  payment_schedule: PaymentInstallment[];
}

const EMPTY_LINE: () => LineItemForm = () => ({
  id: Math.random().toString(36).slice(2),
  description: "",
  quantity: "1",
  rate: "",
});

const mkInstallment = (label: string, pct: number, total: number, due: string = ""): PaymentInstallment => ({
  id: Math.random().toString(36).slice(2),
  label,
  amount: Math.round(total * pct * 100) / 100,
  due_date: due,
  status: "unpaid",
});

const EMPTY_FORM: InvoiceFormState = {
  invoice_number: "", client_name: "", client_email: "", description: "", status: "draft",
  invoice_date: "", due_date: "", paid_date: "", notes: "", project_id: "",
  line_items: [EMPTY_LINE()], tax_rate: "0", payment_terms: "net30",
  use_payment_schedule: false,
  payment_schedule: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nextInvoiceNumber(invoices: Invoice[]) {
  const nums = invoices
    .map((i) => parseInt(i.invoice_number.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  return `INV-${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(4, "0")}`;
}

function computeTotals(form: InvoiceFormState) {
  const subtotal = form.line_items.reduce(
    (s, li) => s + (parseFloat(li.quantity) || 0) * (parseFloat(li.rate) || 0),
    0
  );
  const taxRate = parseFloat(form.tax_rate) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

// ─── Date Input ───────────────────────────────────────────────────────────────

function DateInput({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);

  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div>
      <label className="fin-label">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => ref.current?.showPicker()}
          className="fin-input flex items-center gap-2 text-left cursor-pointer hover:border-[#d4a853]/40 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground/50">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className={display ? "text-foreground" : "text-muted-foreground"}>
            {display ?? "Pick a date"}
          </span>
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="ml-auto text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </button>
        <input
          ref={ref}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 pointer-events-none w-full"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [budgetsByProject, setBudgetsByProject] = useState<Record<string, BudgetLine[]>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "projects" | "quotes">("overview");
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [allProjects, allInvoices, prof, allQuotes] = await Promise.all([
          getProjects(), getInvoices(), getProfile(), getQuotes(),
        ]);
        if (!alive) return;
        setProjects(allProjects);
        setInvoices(allInvoices);
        setProfile(prof);
        setQuotes(allQuotes);
        const budgetResults = await Promise.all(
          allProjects.map((p) => getBudgetLines(p.id).catch(() => [] as BudgetLine[]))
        );
        if (!alive) return;
        const map: Record<string, BudgetLine[]> = {};
        allProjects.forEach((p, i) => { map[p.id] = budgetResults[i]; });
        setBudgetsByProject(map);
      } catch { /* silent */ } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    const revenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const outstanding = invoices
      .filter((i) => ["sent", "partial", "overdue"].includes(i.status))
      .reduce((s, i) => s + (i.amount - i.amount_paid), 0);
    const expenses = Object.values(budgetsByProject).flat().reduce((s, l) => s + (l.actual ?? 0), 0);
    return { revenue, outstanding, expenses, profit: revenue - expenses };
  }, [invoices, budgetsByProject]);

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const revenue = invoices
        .filter((inv) => inv.status === "paid" && inv.paid_date?.startsWith(key))
        .reduce((s, inv) => s + inv.amount, 0);
      const expenses = Object.values(budgetsByProject).flat()
        .filter((l) => l.created_at?.startsWith(key))
        .reduce((s, l) => s + (l.actual ?? 0), 0);
      return { month: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, revenue, expenses };
    });
  }, [invoices, budgetsByProject]);

  const projectSummaries = useMemo(() =>
    projects.map((p) => {
      const pi = invoices.filter((i) => i.project_id === p.id);
      const invoiced = pi.reduce((s, i) => s + i.amount, 0);
      const collected = pi.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
      const lines = budgetsByProject[p.id] ?? [];
      const actual = lines.reduce((s, l) => s + (l.actual ?? 0), 0);
      const profit = collected - actual;
      const margin = collected > 0 ? Math.round((profit / collected) * 100) : null;
      return { ...p, invoiced, collected, budgeted: lines.reduce((s, l) => s + l.budgeted, 0), actual, profit, margin, invoiceCount: pi.length };
    }).filter((p) => p.invoiced > 0 || (budgetsByProject[p.id]?.length ?? 0) > 0),
  [projects, invoices, budgetsByProject]);

  // ── Form helpers ──────────────────────────────────────────────────────────

  function openNewForm() {
    const today = new Date().toISOString().split("T")[0];
    setForm({ ...EMPTY_FORM, invoice_number: nextInvoiceNumber(invoices), line_items: [EMPTY_LINE()], invoice_date: today });
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(inv: Invoice) {
    const lineItems: LineItemForm[] = inv.line_items?.map((li) => ({
      id: li.id ?? Math.random().toString(36).slice(2),
      description: li.description,
      quantity: String(li.quantity),
      rate: String(li.rate),
    })) ?? [EMPTY_LINE()];

    setForm({
      invoice_number: inv.invoice_number,
      client_name: inv.client_name ?? "",
      client_email: inv.client_email ?? "",
      description: inv.description ?? "",
      status: inv.status,
      invoice_date: inv.invoice_date ?? "",
      due_date: inv.due_date ?? "",
      paid_date: inv.paid_date ?? "",
      notes: inv.notes ?? "",
      project_id: inv.project_id ?? "",
      line_items: lineItems,
      tax_rate: String(inv.tax_rate ?? 0),
      payment_terms: inv.payment_terms ?? "net30",
      use_payment_schedule: !!(inv.payment_schedule && inv.payment_schedule.length > 0),
      payment_schedule: inv.payment_schedule ?? [],
    });
    setEditingId(inv.id);
    setShowForm(true);
  }

  async function handleSave(andSend = false) {
    if (!form.invoice_number.trim()) { toast.error("Invoice number required."); return; }
    const { subtotal, total } = computeTotals(form);
    if (total <= 0 && subtotal <= 0) { toast.error("Add at least one line item with a rate."); return; }

    setSaving(true);
    try {
      const lineItems = form.line_items
        .filter((li) => li.description.trim() || parseFloat(li.rate) > 0)
        .map((li) => ({
          id: li.id,
          description: li.description.trim(),
          quantity: parseFloat(li.quantity) || 1,
          rate: parseFloat(li.rate) || 0,
        }));

      const payload = {
        invoice_number: form.invoice_number.trim(),
        client_name: form.client_name.trim() || undefined,
        client_email: form.client_email.trim() || undefined,
        description: form.description.trim() || undefined,
        amount: total,
        amount_paid: editingId
          ? (invoices.find((i) => i.id === editingId)?.amount_paid ?? 0)
          : 0,
        status: form.status,
        invoice_date: form.invoice_date || undefined,
        due_date: form.due_date || undefined,
        paid_date: form.paid_date || undefined,
        notes: form.notes.trim() || undefined,
        project_id: form.project_id || undefined,
        line_items: lineItems.length > 0 ? lineItems : undefined,
        tax_rate: parseFloat(form.tax_rate) || 0,
        payment_terms: form.payment_terms,
        payment_schedule: form.use_payment_schedule && form.payment_schedule.length > 0
          ? form.payment_schedule
          : undefined,
      };

      let savedId: string;
      if (editingId) {
        const updated = await updateInvoice(editingId, payload);
        setInvoices((prev) => prev.map((i) => i.id === editingId ? updated : i));
        savedId = editingId;
        toast.success("Invoice updated.");
      } else {
        const created = await createInvoice(payload as Parameters<typeof createInvoice>[0]);
        setInvoices((prev) => [created, ...prev]);
        savedId = created.id;
        toast.success("Invoice created.");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);

      if (andSend) {
        setSending(true);
        try {
          const res = await fetch("/api/invoices/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId: savedId }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || "Failed to send invoice.");
          } else {
            setInvoices((prev) => prev.map((i) => i.id === savedId ? { ...i, status: "sent" as InvoiceStatus } : i));
            toast.success("Invoice sent to client!");
          }
        } finally {
          setSending(false);
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function markInstallmentPaid(inv: Invoice, installmentId: string) {
    const schedule = (inv.payment_schedule ?? []).map((inst) =>
      inst.id === installmentId
        ? { ...inst, status: "paid" as const, paid_at: new Date().toISOString() }
        : inst
    );
    const totalPaid = schedule
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + i.amount, 0);
    const allPaid = schedule.every((i) => i.status === "paid");
    const updates: Partial<Invoice> = {
      payment_schedule: schedule,
      amount_paid: totalPaid,
      status: allPaid ? "paid" : totalPaid > 0 ? "partial" : inv.status,
    };
    if (allPaid) updates.paid_date = new Date().toISOString().split("T")[0];
    try {
      const updated = await updateInvoice(inv.id, updates);
      setInvoices((prev) => prev.map((i) => i.id === inv.id ? updated : i));
      if (viewingInvoice?.id === inv.id) setViewingInvoice(updated);
      toast.success(allPaid ? "Invoice fully paid!" : "Installment marked paid");
    } catch { toast.error("Failed to update installment"); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteInvoice(id);
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      toast.success("Deleted.");
    } catch { toast.error("Failed to delete."); }
    finally { setDeletingId(null); }
  }

  async function quickStatus(inv: Invoice, status: InvoiceStatus) {
    const updates: Partial<Invoice> = { status };
    if (status === "paid") {
      updates.amount_paid = inv.amount;
      updates.paid_date = new Date().toISOString().split("T")[0];
    }
    try {
      const updated = await updateInvoice(inv.id, updates);
      setInvoices((prev) => prev.map((i) => i.id === inv.id ? updated : i));
      if (viewingInvoice?.id === inv.id) setViewingInvoice(updated);
      toast.success(`Marked as ${status}.`);
      if (status === "paid") {
        createNotification({
          type: "invoice_paid",
          title: `Invoice paid${updated.invoice_number ? " · " + updated.invoice_number : ""}`,
          description: `${updated.client_name ? updated.client_name + " · " : ""}$${(updated.amount ?? 0).toLocaleString()}`,
          href: "/finance",
        });
      }
    } catch { toast.error("Failed to update."); }
  }

  const handleInvoiceUpdated = useCallback((updated: Invoice) => {
    setInvoices((prev) => prev.map((i) => i.id === updated.id ? updated : i));
    setViewingInvoice(updated);
  }, []);

  // ── Line item helpers ─────────────────────────────────────────────────────

  const setLi = (id: string, key: keyof LineItemForm, val: string) =>
    setForm((f) => ({
      ...f,
      line_items: f.line_items.map((li) => li.id === id ? { ...li, [key]: val } : li),
    }));

  const addLine = () =>
    setForm((f) => ({ ...f, line_items: [...f.line_items, EMPTY_LINE()] }));

  const removeLine = (id: string) =>
    setForm((f) => ({ ...f, line_items: f.line_items.filter((li) => li.id !== id) }));

  const { subtotal, taxAmount, total } = computeTotals(form);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Topbar */}
      <div className="shrink-0 border-b border-border bg-card/50 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">Finance</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Revenue, expenses &amp; invoices across all projects</p>
          </div>
          <button
            onClick={openNewForm}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New Invoice
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[
            { label: "YTD Revenue",  value: fmt(stats.revenue),     icon: DollarSign,   color: "text-emerald-400", sub: "Paid invoices" },
            { label: "YTD Expenses", value: fmt(stats.expenses),    icon: TrendingDown, color: "text-red-400",     sub: "Actual spend" },
            { label: "Net Profit",   value: fmt(stats.profit),      icon: stats.profit >= 0 ? TrendingUp : TrendingDown, color: stats.profit >= 0 ? "text-emerald-400" : "text-red-400", sub: "Revenue − Expenses" },
            { label: "Outstanding",  value: fmt(stats.outstanding), icon: Clock,        color: "text-amber-400",   sub: "Awaiting payment" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <s.icon className="h-3 w-3" />{s.label}
              </div>
              <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Sub-tabs */}
        <div className="mt-4 flex gap-1 border-b border-border">
          {(["overview", "invoices", "projects", "quotes"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === t ? "border-[#d4a853] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "overview" ? "Overview"
                : t === "invoices" ? `Invoices (${invoices.length})`
                : t === "projects" ? `Projects (${projectSummaries.length})`
                : `Quotes (${quotes.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-4 font-display text-sm font-semibold text-foreground">Revenue vs Expenses — Last 12 Months</h3>
                  {chartData.every((d) => d.revenue === 0 && d.expenses === 0) ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                      <Layers className="h-8 w-8 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground">No data yet — add invoices and budget lines to see trends.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 13%)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(0 0% 46%)" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "hsl(0 0% 46%)" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(0 0% 100% / 0.03)" }} />
                        <Legend wrapperStyle={{ fontSize: 11, color: "hsl(0 0% 60%)" }} />
                        <Bar dataKey="revenue" name="Revenue" fill="#d4a853" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="hsl(0 62% 40% / 0.7)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-foreground">Recent Invoices</h3>
                    <button onClick={() => setActiveTab("invoices")} className="text-xs text-muted-foreground hover:text-[#d4a853] transition-colors">View all →</button>
                  </div>
                  {invoices.length === 0 ? (
                    <EmptyInvoices onNew={openNewForm} />
                  ) : (
                    <div className="space-y-2">
                      {invoices.slice(0, 5).map((inv) => (
                        <InvoiceRow
                          key={inv.id} inv={inv}
                          onEdit={openEditForm} onDelete={handleDelete}
                          onQuickStatus={quickStatus} onView={setViewingInvoice}
                          onMarkInstallmentPaid={markInstallmentPaid}
                          deletingId={deletingId} projects={projects}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "invoices" && (
              <div className="space-y-2">
                {invoices.length === 0 ? (
                  <EmptyInvoices onNew={openNewForm} />
                ) : (
                  invoices.map((inv) => (
                    <InvoiceRow
                      key={inv.id} inv={inv}
                      onEdit={openEditForm} onDelete={handleDelete}
                      onQuickStatus={quickStatus} onView={setViewingInvoice}
                      onMarkInstallmentPaid={markInstallmentPaid}
                      deletingId={deletingId} projects={projects}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === "quotes" && (
              <QuotesTab
                quotes={quotes}
                projects={projects}
                profile={profile}
                onQuotesChange={setQuotes}
              />
            )}

            {activeTab === "projects" && (
              <div className="space-y-2">
                {projectSummaries.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                    <Receipt className="h-8 w-8 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">No financial data yet.</p>
                    <p className="text-xs text-muted-foreground/60">Add invoices or budget lines to a project to see P&L here.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden sm:grid grid-cols-6 gap-2 rounded-lg bg-muted/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span className="col-span-2">Project</span>
                      <span className="text-right">Invoiced</span>
                      <span className="text-right">Expenses</span>
                      <span className="text-right">Profit</span>
                      <span className="text-right">Margin</span>
                    </div>
                    {projectSummaries.sort((a, b) => b.profit - a.profit).map((p) => (
                      <Link
                        key={p.id} href={`/projects/${p.id}`}
                        className="group rounded-xl border border-border bg-card p-4 transition-colors hover:bg-card/80 block sm:grid sm:grid-cols-6 sm:items-center sm:gap-2"
                      >
                        {/* Name row */}
                        <div className="col-span-2 min-w-0 mb-3 sm:mb-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium text-sm text-foreground">{p.title}</p>
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {p.client_name && <p className="text-xs text-muted-foreground truncate">{p.client_name}</p>}
                        </div>
                        {/* Mobile: 2×2 metric grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:contents">
                          <div className="sm:contents">
                            <p className="text-[10px] text-muted-foreground/50 sm:hidden">Invoiced</p>
                            <p className="sm:hidden text-sm font-medium text-foreground">{fmt(p.invoiced)}</p>
                            <p className="hidden sm:block text-right text-sm text-foreground">{fmt(p.invoiced)}</p>
                          </div>
                          <div className="sm:contents">
                            <p className="text-[10px] text-muted-foreground/50 sm:hidden">Expenses</p>
                            <p className="sm:hidden text-sm font-medium text-foreground">{fmt(p.actual)}</p>
                            <p className="hidden sm:block text-right text-sm text-foreground">{fmt(p.actual)}</p>
                          </div>
                          <div className="sm:contents">
                            <p className="text-[10px] text-muted-foreground/50 sm:hidden">Profit</p>
                            <p className={`sm:hidden text-sm font-medium ${p.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(p.profit)}</p>
                            <p className={`hidden sm:block text-right text-sm font-medium ${p.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(p.profit)}</p>
                          </div>
                          <div className="sm:contents">
                            <p className="text-[10px] text-muted-foreground/50 sm:hidden">Margin</p>
                            <p className={`sm:hidden text-sm font-medium ${p.margin == null ? "text-muted-foreground" : p.margin >= 40 ? "text-emerald-400" : p.margin >= 20 ? "text-amber-400" : "text-red-400"}`}>
                              {p.margin != null ? `${p.margin}%` : "—"}
                            </p>
                            <p className={`hidden sm:block text-right text-sm font-medium ${p.margin == null ? "text-muted-foreground" : p.margin >= 40 ? "text-emerald-400" : p.margin >= 20 ? "text-amber-400" : "text-red-400"}`}>
                              {p.margin != null ? `${p.margin}%` : "—"}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Invoice Form Modal ───────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative z-10 w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl max-h-[calc(100dvh-env(safe-area-inset-top))] sm:max-h-[94vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
              <h2 className="font-display font-semibold text-foreground">
                {editingId ? "Edit Invoice" : "New Invoice"}
              </h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar space-y-5">

              {/* ── Section: Invoice Details ── */}
              <div>
                <p className="fin-section-label">Invoice Details</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="fin-label">Invoice #</label>
                      <input className="fin-input" value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} placeholder="INV-0001" />
                    </div>
                    <div>
                      <label className="fin-label">Status</label>
                      <select className="fin-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InvoiceStatus }))}>
                        {(Object.keys(STATUS_META) as InvoiceStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_META[s].label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="fin-label">Client Name</label>
                      <input className="fin-input" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} placeholder="Client or company name" />
                    </div>
                    <div>
                      <label className="fin-label">Client Email</label>
                      <input className="fin-input" type="email" value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} placeholder="client@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="fin-label">Project</label>
                    <select className="fin-input" value={form.project_id} onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}>
                      <option value="">— Standalone (no project) —</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="fin-label">Description / Subject</label>
                    <input className="fin-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Brand film production — Phase 1" />
                  </div>
                  <div className={`grid gap-3 ${["paid", "partial"].includes(form.status) ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
                    <DateInput
                      label="Invoice Date"
                      value={form.invoice_date}
                      onChange={(v) => setForm((f) => ({ ...f, invoice_date: v }))}
                    />
                    <DateInput
                      label="Due Date"
                      value={form.due_date}
                      onChange={(v) => setForm((f) => ({ ...f, due_date: v }))}
                    />
                    {["paid", "partial"].includes(form.status) && (
                      <DateInput
                        label="Date Paid"
                        value={form.paid_date}
                        onChange={(v) => setForm((f) => ({ ...f, paid_date: v }))}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* ── Section: Line Items ── */}
              <div>
                <p className="fin-section-label">Line Items</p>
                <div className="rounded-xl border border-border overflow-x-auto">
                 <div className="min-w-[420px]">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_3.5rem_5.5rem_5rem_1.5rem] gap-2 bg-muted/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Description</span>
                    <span className="text-center">Qty</span>
                    <span className="text-right">Rate</span>
                    <span className="text-right">Amount</span>
                    <span />
                  </div>
                  {/* Rows */}
                  <div className="divide-y divide-border">
                    {form.line_items.map((li) => {
                      const amount = (parseFloat(li.quantity) || 0) * (parseFloat(li.rate) || 0);
                      return (
                        <div key={li.id} className="grid grid-cols-[1fr_3.5rem_5.5rem_5rem_1.5rem] items-center gap-2 px-3 py-2">
                          <input
                            className="fin-input text-xs"
                            placeholder="Service or item description"
                            value={li.description}
                            onChange={(e) => setLi(li.id, "description", e.target.value)}
                          />
                          <input
                            className="fin-input text-center text-xs"
                            type="number" min="0" step="0.5"
                            value={li.quantity}
                            onChange={(e) => setLi(li.id, "quantity", e.target.value)}
                          />
                          <input
                            className="fin-input text-right text-xs"
                            type="number" min="0" step="0.01"
                            placeholder="$0.00"
                            value={li.rate}
                            onChange={(e) => setLi(li.id, "rate", e.target.value)}
                          />
                          <span className="text-right text-xs font-medium text-foreground">
                            {amount > 0 ? fmtFull(amount) : "—"}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(li.id)}
                            disabled={form.line_items.length === 1}
                            className="rounded p-0.5 text-muted-foreground/40 hover:text-red-400 transition-colors disabled:opacity-20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {/* Add row + totals */}
                  <div className="border-t border-border bg-muted/5 px-3 py-2">
                    <button
                      type="button"
                      onClick={addLine}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#d4a853] transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add line item
                    </button>
                  </div>
                 </div>
                </div>

                {/* Totals */}
                <div className="mt-3 flex justify-end">
                  <div className="w-56 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{fmtFull(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Tax</span>
                        <input
                          className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs text-foreground outline-none focus:border-[#d4a853]/50"
                          type="number" min="0" max="100" step="0.5"
                          value={form.tax_rate}
                          onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{fmtFull(taxAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-1.5 text-sm font-bold text-foreground">
                      <span>Total</span>
                      <span className="text-[#d4a853]">{fmtFull(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Section: Payment ── */}
              <div>
                <p className="fin-section-label">Payment</p>
                <div className="space-y-3">
                  <div>
                    <label className="fin-label">Terms</label>
                    <select
                      className="fin-input"
                      value={form.payment_terms}
                      onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value as PaymentTerms }))}
                    >
                      {PAYMENT_TERMS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <p className="rounded-lg border border-border bg-muted/10 px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                    All payment methods you&apos;ve configured in{" "}
                    <a href="/settings" className="text-[#d4a853] hover:underline">Settings → Payment</a>
                    {" "}will appear on the invoice automatically. Your client picks whichever works for them.
                  </p>
                </div>
              </div>

              {/* ── Section: Payment Schedule ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="fin-section-label" style={{ marginBottom: 0 }}>Payment Schedule</p>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <span>Split into payments</span>
                    <button
                      type="button"
                      onClick={() => {
                        const enabling = !form.use_payment_schedule;
                        if (enabling && form.payment_schedule.length === 0) {
                          const half = Math.round(total * 0.5 * 100) / 100;
                          setForm((f) => ({
                            ...f,
                            use_payment_schedule: true,
                            payment_schedule: [
                              mkInstallment("Deposit (50%)", 0.5, total),
                              mkInstallment("Balance on Delivery (50%)", 0.5, total),
                            ],
                          }));
                        } else {
                          setForm((f) => ({ ...f, use_payment_schedule: enabling }));
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${form.use_payment_schedule ? "bg-[#d4a853]" : "bg-muted"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.use_payment_schedule ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </label>
                </div>
                {form.use_payment_schedule && (
                  <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
                    <div className="grid grid-cols-[1fr_5.5rem_6rem_1.5rem] gap-2 bg-muted/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Label</span>
                      <span className="text-right">Amount</span>
                      <span>Due Date</span>
                      <span />
                    </div>
                    <div className="divide-y divide-border">
                      {form.payment_schedule.map((inst, idx) => (
                        <div key={inst.id} className="grid grid-cols-[1fr_5.5rem_6rem_1.5rem] items-center gap-2 px-3 py-2">
                          <input
                            className="fin-input text-xs"
                            placeholder="e.g. Deposit"
                            value={inst.label}
                            onChange={(e) => setForm((f) => ({
                              ...f,
                              payment_schedule: f.payment_schedule.map((i) => i.id === inst.id ? { ...i, label: e.target.value } : i),
                            }))}
                          />
                          <input
                            className="fin-input text-right text-xs"
                            type="number" min="0" step="0.01"
                            value={inst.amount}
                            onChange={(e) => setForm((f) => ({
                              ...f,
                              payment_schedule: f.payment_schedule.map((i) => i.id === inst.id ? { ...i, amount: parseFloat(e.target.value) || 0 } : i),
                            }))}
                          />
                          <input
                            className="fin-input text-xs [color-scheme:dark]"
                            type="date"
                            value={inst.due_date ?? ""}
                            onChange={(e) => setForm((f) => ({
                              ...f,
                              payment_schedule: f.payment_schedule.map((i) => i.id === inst.id ? { ...i, due_date: e.target.value } : i),
                            }))}
                          />
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, payment_schedule: f.payment_schedule.filter((i) => i.id !== inst.id) }))}
                            className="rounded p-0.5 text-muted-foreground/40 hover:text-red-400 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border bg-muted/5 px-3 py-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({
                          ...f,
                          payment_schedule: [...f.payment_schedule, mkInstallment("Installment", 0, total)],
                        }))}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#d4a853] transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Add installment
                      </button>
                      <span className={`text-xs font-medium ${
                        Math.abs(form.payment_schedule.reduce((s, i) => s + i.amount, 0) - total) < 0.01
                          ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {fmtFull(form.payment_schedule.reduce((s, i) => s + i.amount, 0))} / {fmtFull(total)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section: Notes ── */}
              <div>
                <label className="fin-label">Internal Notes</label>
                <textarea
                  className="fin-input resize-none"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes visible on the invoice…"
                />
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-border px-5 py-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{fmtFull(total)}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSave(false)}
                    disabled={saving || sending}
                    className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-60"
                  >
                    {saving && !sending
                      ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      : <Check className="h-3.5 w-3.5" />
                    }
                    {editingId ? "Save" : "Create"}
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving || sending}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors disabled:opacity-60"
                  >
                    {sending
                      ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      : <Send className="h-3.5 w-3.5" />
                    }
                    Save & Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Document View ────────────────────────────────────────────── */}
      {viewingInvoice && (
        <InvoiceDocument
          invoice={viewingInvoice}
          profile={profile}
          onClose={() => setViewingInvoice(null)}
          onInvoiceUpdated={handleInvoiceUpdated}
        />
      )}

      <style jsx>{`
        .fin-section-label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.625rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: hsl(var(--muted-foreground));
        }
        .fin-label {
          display: block;
          margin-bottom: 0.25rem;
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: hsl(var(--muted-foreground));
        }
        .fin-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.4rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          outline: none;
        }
        .fin-input:focus {
          border-color: rgba(212,168,83,0.5);
          box-shadow: 0 0 0 1px rgba(212,168,83,0.3);
        }
        .fin-input::placeholder { color: hsl(var(--muted-foreground)); }
        select.fin-input {
          -webkit-appearance: none;
          appearance: none;
          cursor: pointer;
          background-color: hsl(var(--background));
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.6rem center;
          padding-right: 1.75rem;
        }
        select.fin-input:focus {
          background-color: hsl(var(--background));
        }
        select.fin-input option { background: hsl(var(--card)); color: hsl(var(--foreground)); }
        input[type="number"].fin-input::-webkit-outer-spin-button,
        input[type="number"].fin-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"].fin-input { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}

// ─── Invoice Row ──────────────────────────────────────────────────────────────

function InvoiceRow({ inv, onEdit, onDelete, onQuickStatus, onView, onMarkInstallmentPaid, deletingId, projects }: {
  inv: Invoice;
  onEdit: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  onQuickStatus: (inv: Invoice, s: InvoiceStatus) => void;
  onView: (inv: Invoice) => void;
  onMarkInstallmentPaid: (inv: Invoice, installmentId: string) => void;
  deletingId: string | null;
  projects: Project[];
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const project = projects.find((p) => p.id === inv.project_id);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);
  const outstanding = inv.amount - inv.amount_paid;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground">{inv.invoice_number}</span>
            <StatusBadge status={inv.status} />
            {project && <span className="text-[10px] text-muted-foreground/60 truncate">· {project.title}</span>}
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">
            {inv.client_name || inv.description || "—"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">{fmt(inv.amount)}</p>
          {outstanding > 0 && inv.status !== "paid" && (
            <p className="text-[10px] text-amber-400">{fmt(outstanding)} due</p>
          )}
        </div>
        {open
          ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        }
      </div>

      {open && (
        <div className="border-t border-border bg-muted/5 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
            {[
              { label: "Amount",       value: fmt(inv.amount) },
              { label: "Paid",         value: fmt(inv.amount_paid) },
              { label: "Due Date",     value: inv.due_date ?? "—" },
              { label: "Paid Date",    value: inv.paid_date ?? "—" },
            ].map((d) => (
              <div key={d.label}>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.label}</p>
                <p className="font-medium text-foreground">{d.value}</p>
              </div>
            ))}
          </div>
          {inv.description && <p className="text-xs text-muted-foreground">{inv.description}</p>}
          {inv.notes && <p className="text-xs text-muted-foreground/60 italic">{inv.notes}</p>}

          {/* ── Payment Schedule ── */}
          {inv.payment_schedule && inv.payment_schedule.length > 0 && (
            <div className="rounded-lg border border-border bg-background overflow-hidden">
              <div className="grid grid-cols-[1fr_5rem_5.5rem_auto] gap-2 px-3 py-1.5 bg-muted/20 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Installment</span>
                <span className="text-right">Amount</span>
                <span>Due</span>
                <span />
              </div>
              {inv.payment_schedule.map((inst) => (
                <div key={inst.id} className={`grid grid-cols-[1fr_5rem_5.5rem_auto] items-center gap-2 px-3 py-2 border-t border-border ${inst.status === "paid" ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {inst.status === "paid"
                      ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                      : <div className="h-3 w-3 shrink-0 rounded-full border border-muted-foreground/40" />
                    }
                    <span className="text-xs truncate text-foreground">{inst.label}</span>
                  </div>
                  <span className="text-right text-xs font-medium text-foreground">{fmtFull(inst.amount)}</span>
                  <span className="text-xs text-muted-foreground">{inst.due_date || "—"}</span>
                  {inst.status === "unpaid" ? (
                    <button
                      onClick={() => onMarkInstallmentPaid(inv, inst.id)}
                      className="flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                    >
                      <Check className="h-2.5 w-2.5" /> Paid
                    </button>
                  ) : (
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Paid</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {inv.status !== "paid" && (
              <button
                onClick={() => onQuickStatus(inv, "paid")}
                className="flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" /> Mark Paid
              </button>
            )}
            {inv.status === "draft" && (
              <button
                onClick={() => onQuickStatus(inv, "sent")}
                className="flex items-center gap-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[10px] font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <Send className="h-3 w-3" /> Mark Sent
              </button>
            )}
            {!["paid", "overdue"].includes(inv.status) && (
              <button
                onClick={() => onQuickStatus(inv, "overdue")}
                className="flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <AlertCircle className="h-3 w-3" /> Mark Overdue
              </button>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => onView(inv)}
                className="flex items-center gap-1 rounded px-2 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-[#d4a853] transition-colors"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </button>
              <button
                onClick={() => onEdit(inv)}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              {confirmDelete ? (
                <button
                  onClick={() => { onDelete(inv.id); setConfirmDelete(false); }}
                  disabled={deletingId === inv.id}
                  className="flex items-center gap-1 rounded-lg bg-red-500/15 border border-red-500/30 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/25 transition-colors"
                >
                  {deletingId === inv.id
                    ? <span className="block h-3 w-3 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
                    : "Delete?"
                  }
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyInvoices({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
      <Receipt className="h-8 w-8 text-muted-foreground/20" />
      <p className="text-sm font-medium text-muted-foreground">No invoices yet</p>
      <p className="text-xs text-muted-foreground/60">Create your first invoice to track revenue.</p>
      <button
        onClick={onNew}
        className="mt-1 flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> New Invoice
      </button>
    </div>
  );
}
