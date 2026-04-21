"use client";

import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, Star, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { Quote, QuoteType, PaymentTerms, Project, Profile } from "@/types";

// ─── Local form types ─────────────────────────────────────────────────────────

export interface LineItemForm {
  id: string;
  description: string;
  quantity: string;
  rate: string;
}

interface PackageForm {
  id: string;
  name: string;
  description: string;
  line_items: LineItemForm[];
  highlighted: boolean;
}

interface RetainerDeliverableForm {
  id: string;
  type: string;
  label: string;
  quantity: string;
}

export interface QuoteFormState {
  quote_number: string;
  quote_type: QuoteType;
  client_name: string;
  client_email: string;
  project_id: string;
  description: string;
  scope_of_work: string;
  use_packages: boolean;
  line_items: LineItemForm[];
  packages: PackageForm[];
  tax_rate: string;
  discount: string;
  payment_terms: PaymentTerms;
  valid_until: string;
  notes: string;
  monthly_rate: string;
  retainer_months: string;
  retainer_deliverables: RetainerDeliverableForm[];
}

const PAYMENT_TERMS_OPTIONS: { value: PaymentTerms; label: string }[] = [
  { value: "due_on_receipt", label: "Due on Receipt" },
  { value: "net15", label: "Net 15" },
  { value: "net30", label: "Net 30" },
  { value: "net60", label: "Net 60" },
];

const emptyLine = (): LineItemForm => ({
  id: Math.random().toString(36).slice(2),
  description: "",
  quantity: "1",
  rate: "",
});

const emptyPackage = (name: string): PackageForm => ({
  id: Math.random().toString(36).slice(2),
  name,
  description: "",
  line_items: [emptyLine()],
  highlighted: false,
});

const emptyDeliverable = (): RetainerDeliverableForm => ({
  id: Math.random().toString(36).slice(2),
  type: "deliverable",
  label: "",
  quantity: "1",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcLineItems(items: LineItemForm[]) {
  return items.reduce((s, li) => s + (parseFloat(li.quantity) || 0) * (parseFloat(li.rate) || 0), 0);
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

// ─── Line Items sub-builder ───────────────────────────────────────────────────

function LineItemsBuilder({
  items,
  onChange,
}: {
  items: LineItemForm[];
  onChange: (items: LineItemForm[]) => void;
}) {
  function update(id: string, field: keyof LineItemForm, value: string) {
    onChange(items.map((li) => (li.id === id ? { ...li, [field]: value } : li)));
  }
  function remove(id: string) {
    onChange(items.filter((li) => li.id !== id));
  }
  function add() {
    onChange([...items, emptyLine()]);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_60px_80px_24px] gap-1.5 px-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        <span>Description</span><span className="text-center">Qty</span><span className="text-right">Rate</span><span />
      </div>
      {items.map((li) => (
        <div key={li.id} className="grid grid-cols-[1fr_60px_80px_24px] gap-1.5">
          <input
            value={li.description}
            onChange={(e) => update(li.id, "description", e.target.value)}
            placeholder="Service or deliverable"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors"
          />
          <input
            value={li.quantity}
            onChange={(e) => update(li.id, "quantity", e.target.value)}
            type="number"
            min="0"
            step="0.5"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-center text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors"
          />
          <input
            value={li.rate}
            onChange={(e) => update(li.id, "rate", e.target.value)}
            type="number"
            min="0"
            step="50"
            placeholder="0"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors text-right"
          />
          <button
            type="button"
            onClick={() => remove(li.id)}
            disabled={items.length === 1}
            className="flex items-center justify-center text-muted-foreground/40 hover:text-red-400 disabled:opacity-20 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#d4a853] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add line item
      </button>
    </div>
  );
}

// ─── Package builder card ─────────────────────────────────────────────────────

function PackageCard({
  pkg,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  pkg: PackageForm;
  index: number;
  onChange: (pkg: PackageForm) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const subtotal = calcLineItems(pkg.line_items);
  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${pkg.highlighted ? "border-[#d4a853]/60 bg-[#d4a853]/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2">
        <input
          value={pkg.name}
          onChange={(e) => onChange({ ...pkg, name: e.target.value })}
          placeholder={`Package ${index + 1}`}
          className="flex-1 rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors font-semibold"
        />
        <button
          type="button"
          title="Mark as recommended"
          onClick={() => onChange({ ...pkg, highlighted: !pkg.highlighted })}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
            pkg.highlighted
              ? "border-[#d4a853]/60 bg-[#d4a853]/10 text-[#d4a853]"
              : "border-border text-muted-foreground hover:border-[#d4a853]/40 hover:text-[#d4a853]"
          }`}
        >
          <Star className="h-3 w-3" />
          {pkg.highlighted ? "Recommended" : "Mark recommended"}
        </button>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-muted-foreground/40 hover:text-red-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <input
        value={pkg.description}
        onChange={(e) => onChange({ ...pkg, description: e.target.value })}
        placeholder="Short package description (shown to client)"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-muted-foreground placeholder:text-muted-foreground/60 outline-none focus:border-[#d4a853]/50 transition-colors"
      />
      <LineItemsBuilder
        items={pkg.line_items}
        onChange={(items) => onChange({ ...pkg, line_items: items })}
      />
      <div className="flex justify-end pt-1 text-sm font-semibold text-foreground">
        {fmt(subtotal)}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (formState: QuoteFormState) => Promise<void>;
  initial?: Partial<QuoteFormState>;
  projects: Project[];
  profile: Profile | null;
  quotes: Quote[];
}

export default function QuoteFormModal({ open, onClose, onSave, initial, projects, profile, quotes }: Props) {
  const defaultForm = (): QuoteFormState => ({
    quote_number: "",
    quote_type: "project",
    client_name: "",
    client_email: "",
    project_id: "",
    description: "",
    scope_of_work: "",
    use_packages: false,
    line_items: [emptyLine()],
    packages: [emptyPackage("Essential"), emptyPackage("Pro"), emptyPackage("Premium")],
    tax_rate: "0",
    discount: "0",
    payment_terms: "net30",
    valid_until: "",
    notes: "",
    monthly_rate: "",
    retainer_months: "3",
    retainer_deliverables: [
      { id: Math.random().toString(36).slice(2), type: "short", label: "Short-form Videos", quantity: "4" },
      { id: Math.random().toString(36).slice(2), type: "photo", label: "Photo Session", quantity: "1" },
    ],
  });

  const [form, setForm] = useState<QuoteFormState>(defaultForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const nums = quotes.map((q) => parseInt(q.quote_number.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
      const nextNum = `QUO-${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(4, "0")}`;
      setForm({ ...defaultForm(), quote_number: nextNum, ...initial });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function set<K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Totals
  const subtotal = form.use_packages
    ? 0
    : calcLineItems(form.line_items);
  const taxRate = parseFloat(form.tax_rate) || 0;
  const discount = parseFloat(form.discount) || 0;
  const taxAmount = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + taxAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name.trim()) { toast.error("Client name is required"); return; }
    if (form.quote_type === "project" && !form.use_packages) {
      const hasItems = form.line_items.some((li) => li.description.trim() && parseFloat(li.rate) > 0);
      if (!hasItems) { toast.error("Add at least one line item with a rate"); return; }
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  // Package handlers
  function updatePackage(id: string, pkg: PackageForm) {
    set("packages", form.packages.map((p) => (p.id === id ? pkg : p)));
  }
  function removePackage(id: string) {
    set("packages", form.packages.filter((p) => p.id !== id));
  }
  function addPackage() {
    set("packages", [...form.packages, emptyPackage(`Package ${form.packages.length + 1}`)]);
  }

  // Retainer deliverable handlers
  function updateDeliverable(id: string, field: keyof RetainerDeliverableForm, value: string) {
    set("retainer_deliverables", form.retainer_deliverables.map((d) => d.id === id ? { ...d, [field]: value } : d));
  }
  function removeDeliverable(id: string) {
    set("retainer_deliverables", form.retainer_deliverables.filter((d) => d.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-[#0f0f0f] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-foreground">
              {initial ? "Edit Quote" : "New Quote"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Build a professional proposal for your client</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="divide-y divide-border">
          {/* ── Quote type ── */}
          <div className="px-6 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quote type</p>
            <div className="grid grid-cols-2 gap-2">
              {(["project", "retainer"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("quote_type", t)}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    form.quote_type === t
                      ? "border-[#d4a853]/60 bg-[#d4a853]/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
                  }`}
                >
                  <p className="text-sm font-semibold capitalize">{t === "project" ? "Project Quote" : "Retainer Proposal"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t === "project" ? "One-time engagement with line items" : "Recurring monthly agreement"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Client & basics ── */}
          <div className="px-6 py-4 grid grid-cols-2 gap-3">
            <p className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Client / Company name *</label>
              <input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} placeholder="Meridian Films" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Client email</label>
              <input value={form.client_email} onChange={(e) => set("client_email", e.target.value)} type="email" placeholder="client@company.com" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Quote #</label>
              <input value={form.quote_number} onChange={(e) => set("quote_number", e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors font-mono" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Link to project (optional)</label>
              <div className="relative">
                <select value={form.project_id} onChange={(e) => set("project_id", e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors appearance-none pr-8">
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">One-line description</label>
              <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. 90-second brand film for product launch" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" />
            </div>
          </div>

          {/* ── Scope of work ── */}
          <div className="px-6 py-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scope of work</p>
            <textarea
              value={form.scope_of_work}
              onChange={(e) => set("scope_of_work", e.target.value)}
              rows={4}
              placeholder="Describe the project scope, deliverables, and any important details the client should know before reviewing pricing..."
              className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* ── Pricing — PROJECT type ── */}
          {form.quote_type === "project" && (
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing</p>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                  <span>Use package tiers</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.use_packages}
                    onClick={() => set("use_packages", !form.use_packages)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                      form.use_packages ? "border-[#d4a853] bg-[#d4a853]/20" : "border-border bg-muted"
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.use_packages ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                  </button>
                </label>
              </div>

              {!form.use_packages ? (
                <>
                  <LineItemsBuilder items={form.line_items} onChange={(items) => set("line_items", items)} />
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Discount ($)</label>
                      <input value={form.discount} onChange={(e) => set("discount", e.target.value)} type="number" min="0" step="50" placeholder="0" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">Tax rate (%)</label>
                      <input value={form.tax_rate} onChange={(e) => set("tax_rate", e.target.value)} type="number" min="0" max="50" step="0.5" placeholder="0" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-1 rounded-xl border border-border bg-card px-4 py-3 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                    {discount > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>−{fmt(discount)}</span></div>}
                    {taxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax ({taxRate}%)</span><span>{fmt(taxAmount)}</span></div>}
                    <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-foreground"><span>Total</span><span>{fmt(total)}</span></div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Present multiple options — client picks one on the quote page.</p>
                  {form.packages.map((pkg, i) => (
                    <PackageCard
                      key={pkg.id}
                      pkg={pkg}
                      index={i}
                      onChange={(p) => updatePackage(pkg.id, p)}
                      onRemove={() => removePackage(pkg.id)}
                      canRemove={form.packages.length > 1}
                    />
                  ))}
                  {form.packages.length < 4 && (
                    <button type="button" onClick={addPackage} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-[#d4a853]/40 hover:text-[#d4a853] transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Add another package
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Pricing — RETAINER type ── */}
          {form.quote_type === "retainer" && (
            <div className="px-6 py-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Retainer details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Monthly rate ($)</label>
                  <input value={form.monthly_rate} onChange={(e) => set("monthly_rate", e.target.value)} type="number" min="0" step="100" placeholder="3500" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Contract length (months)</label>
                  <input value={form.retainer_months} onChange={(e) => set("retainer_months", e.target.value)} type="number" min="1" max="24" placeholder="3" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" />
                </div>
              </div>
              {form.monthly_rate && (
                <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Per month</span><span>{fmt(parseFloat(form.monthly_rate) || 0)}</span></div>
                  <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-foreground">
                    <span>Total ({form.retainer_months || 1} mo)</span>
                    <span>{fmt((parseFloat(form.monthly_rate) || 0) * (parseInt(form.retainer_months) || 1))}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="block text-[11px] font-medium text-muted-foreground mb-1">Monthly deliverables</p>
                {form.retainer_deliverables.map((d) => (
                  <div key={d.id} className="grid grid-cols-[1fr_60px_24px] gap-1.5">
                    <input value={d.label} onChange={(e) => updateDeliverable(d.id, "label", e.target.value)} placeholder="Short-form videos" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" />
                    <input value={d.quantity} onChange={(e) => updateDeliverable(d.id, "quantity", e.target.value)} type="number" min="1" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-center text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" />
                    <button type="button" onClick={() => removeDeliverable(d.id)} disabled={form.retainer_deliverables.length === 1} className="flex items-center justify-center text-muted-foreground/40 hover:text-red-400 disabled:opacity-20 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => set("retainer_deliverables", [...form.retainer_deliverables, emptyDeliverable()])} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#d4a853] transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add deliverable
                </button>
              </div>
            </div>
          )}

          {/* ── Terms & validity ── */}
          <div className="px-6 py-4 grid grid-cols-2 gap-3">
            <p className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Terms</p>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Payment terms</label>
              <div className="relative">
                <select value={form.payment_terms} onChange={(e) => set("payment_terms", e.target.value as PaymentTerms)} className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors appearance-none pr-8">
                  {PAYMENT_TERMS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Valid until</label>
              <input value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} type="date" className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Internal notes (not shown to client)</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Margin targets, negotiation room, etc." className="w-full rounded-lg border border-border bg-background px-2.5 py-[7px] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#d4a853]/50 transition-colors resize-none" />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-2 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-5 py-2 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save Quote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
