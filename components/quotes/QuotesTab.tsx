"use client";

import { useState } from "react";
import {
  Plus, Copy, Check, ChevronDown, ChevronUp, ExternalLink,
  Trash2, Edit3, Send, Eye, FileText, Clock, CheckCircle2,
  XCircle, AlertCircle, ArrowRight, RotateCcw, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { createQuote, updateQuote, deleteQuote } from "@/lib/supabase/queries";
import QuoteFormModal, { type QuoteFormState } from "./QuoteFormModal";
import type { Quote, QuoteStatus, QuotePackage, LineItem, Project, Profile, RetainerTemplateItem } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<QuoteStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft:    { label: "Draft",    color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",         icon: FileText },
  sent:     { label: "Sent",     color: "bg-blue-500/15 text-blue-400 border-blue-500/20",          icon: Send },
  viewed:   { label: "Viewed",   color: "bg-purple-500/15 text-purple-400 border-purple-500/20",    icon: Eye },
  accepted: { label: "Accepted", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-red-500/15 text-red-400 border-red-500/20",             icon: XCircle },
  expired:  { label: "Expired",  color: "bg-amber-500/15 text-amber-400 border-amber-500/20",       icon: AlertCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function quoteAmount(q: Quote): number {
  if (q.amount > 0) return q.amount;
  if (q.quote_type === "retainer") return (q.monthly_rate ?? 0) * (q.retainer_months ?? 1);
  if (q.packages?.length) return Math.max(...q.packages.map((p) => p.amount ?? 0));
  return (q.line_items ?? []).reduce((s, li) => s + li.quantity * li.rate, 0);
}

function isExpired(q: Quote): boolean {
  if (!q.valid_until) return false;
  return new Date(q.valid_until) < new Date(new Date().toDateString());
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function quotePortalUrl(token: string): string {
  return `${typeof window !== "undefined" ? window.location.origin : "https://www.usecineflow.com"}/quote/${token}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: QuoteStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  );
}

// ─── Quote row ────────────────────────────────────────────────────────────────

function QuoteRow({
  quote,
  projects,
  onEdit,
  onDelete,
  onMarkSent,
  onConvert,
  onChange,
}: {
  quote: Quote;
  projects: Project[];
  onEdit: () => void;
  onDelete: () => void;
  onMarkSent: () => void;
  onConvert: () => void;
  onChange: (q: Quote) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const project = projects.find((p) => p.id === quote.project_id);
  const amount = quoteAmount(quote);
  const expired = isExpired(quote) && !["accepted", "declined"].includes(quote.status);
  const displayStatus: QuoteStatus = expired && quote.status === "sent" ? "expired" : quote.status;
  const portalUrl = quotePortalUrl(quote.token);

  async function copyLink() {
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Quote link copied");
  }

  async function handleConvert() {
    setConverting(true);
    try {
      const res = await fetch("/api/quotes/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Convert failed");
      const { projectId } = await res.json();
      toast.success("Project and invoice created");
      onConvert();
      if (projectId) window.location.href = `/projects/${projectId}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to convert");
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteQuote(quote.id);
      toast.success("Quote deleted");
      onDelete();
    } catch {
      toast.error("Failed to delete quote");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-border/80">
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{quote.quote_number}</span>
            <StatusBadge status={displayStatus} />
            {quote.quote_type === "retainer" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
                <Layers className="h-2.5 w-2.5" /> Retainer
              </span>
            )}
            {quote.packages && quote.packages.length > 0 && (
              <span className="text-[10px] text-muted-foreground/60">{quote.packages.length} tiers</span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-medium text-foreground truncate">
            {quote.client_name || "—"}
            {quote.description ? <span className="text-muted-foreground font-normal"> · {quote.description}</span> : null}
          </p>
          {project && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{project.title}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-foreground">{fmt(amount)}</p>
          {quote.valid_until && (
            <p className={`text-[11px] mt-0.5 ${expired ? "text-amber-400" : "text-muted-foreground/60"}`}>
              {expired ? "Expired" : "Valid to"} {formatDate(quote.valid_until)}
            </p>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground/60 mb-0.5">Client</p>
              <p className="text-foreground font-medium">{quote.client_name || "—"}</p>
              {quote.client_email && <p className="text-muted-foreground/70">{quote.client_email}</p>}
            </div>
            <div>
              <p className="text-muted-foreground/60 mb-0.5">Type</p>
              <p className="text-foreground font-medium capitalize">{quote.quote_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground/60 mb-0.5">Payment terms</p>
              <p className="text-foreground font-medium">{quote.payment_terms?.replace(/_/g, " ") ?? "—"}</p>
            </div>
            {quote.viewed_at && (
              <div>
                <p className="text-muted-foreground/60 mb-0.5">Last viewed</p>
                <p className="text-foreground font-medium">{new Date(quote.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
              </div>
            )}
            {quote.accepted_at && (
              <div>
                <p className="text-muted-foreground/60 mb-0.5">Accepted by</p>
                <p className="text-foreground font-medium">{quote.accepted_name || "Client"}</p>
                {quote.accepted_email && <p className="text-muted-foreground/70">{quote.accepted_email}</p>}
              </div>
            )}
          </div>

          {/* Scope of work */}
          {quote.scope_of_work && (
            <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
              {quote.scope_of_work}
            </div>
          )}

          {/* Line items or packages */}
          {!quote.packages?.length && quote.line_items?.length ? (
            <div className="space-y-1">
              {quote.line_items.map((li, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{li.description} <span className="text-muted-foreground/50">×{li.quantity}</span></span>
                  <span className="text-foreground font-medium">{fmt(li.quantity * li.rate)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold text-foreground">
                <span>Total</span><span>{fmt(amount)}</span>
              </div>
            </div>
          ) : null}

          {/* Package summary */}
          {quote.packages?.length ? (
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${quote.packages.length}, 1fr)` }}>
              {quote.packages.map((pkg) => (
                <div key={pkg.id} className={`rounded-lg border px-3 py-2 text-xs ${pkg.highlighted ? "border-[#d4a853]/40 bg-[#d4a853]/5" : "border-border bg-muted/20"}`}>
                  <p className="font-semibold text-foreground">{pkg.name}</p>
                  <p className="text-[#d4a853] font-bold mt-0.5">{fmt(pkg.amount)}</p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Retainer deliverables */}
          {quote.quote_type === "retainer" && quote.retainer_deliverables?.length ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Monthly deliverables</p>
              {quote.retainer_deliverables.map((d, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="text-foreground font-medium">×{d.quantity}</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            {/* Copy link — available for non-draft */}
            {quote.status !== "draft" && (
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy link"}
              </button>
            )}

            {/* View public page */}
            {quote.status !== "draft" && (
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View
              </a>
            )}

            {/* Mark as sent (draft only) */}
            {quote.status === "draft" && (
              <button
                onClick={onMarkSent}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <Send className="h-3.5 w-3.5" /> Send to client
              </button>
            )}

            {/* Convert to project (accepted only, not yet converted) */}
            {quote.status === "accepted" && !quote.converted_project_id && (
              <button
                onClick={handleConvert}
                disabled={converting}
                className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                {converting ? "Converting…" : "Convert to Project"}
              </button>
            )}

            {/* Already converted */}
            {quote.converted_project_id && (
              <a
                href={`/projects/${quote.converted_project_id}`}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> View Project
              </a>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Edit — only draft or sent */}
              {["draft", "sent"].includes(quote.status) && (
                <button onClick={onEdit} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Edit">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quotes tab ───────────────────────────────────────────────────────────────

interface Props {
  quotes: Quote[];
  projects: Project[];
  profile: Profile | null;
  onQuotesChange: (quotes: Quote[]) => void;
}

export default function QuotesTab({ quotes, projects, profile, onQuotesChange }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function formStateFromQuote(q: Quote): Partial<QuoteFormState> {
    return {
      quote_number: q.quote_number,
      quote_type: q.quote_type,
      client_name: q.client_name ?? "",
      client_email: q.client_email ?? "",
      project_id: q.project_id ?? "",
      description: q.description ?? "",
      scope_of_work: q.scope_of_work ?? "",
      use_packages: (q.packages?.length ?? 0) > 0,
      line_items: q.line_items?.map((li) => ({
        id: li.id,
        description: li.description,
        quantity: String(li.quantity),
        rate: String(li.rate),
      })) ?? [{ id: Math.random().toString(36).slice(2), description: "", quantity: "1", rate: "" }],
      packages: q.packages?.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description ?? "",
        highlighted: pkg.highlighted ?? false,
        line_items: pkg.line_items.map((li) => ({
          id: li.id,
          description: li.description,
          quantity: String(li.quantity),
          rate: String(li.rate),
        })),
      })) ?? [],
      tax_rate: String(q.tax_rate ?? 0),
      discount: String(q.discount ?? 0),
      payment_terms: q.payment_terms ?? "net30",
      valid_until: q.valid_until ?? "",
      notes: q.notes ?? "",
      monthly_rate: String(q.monthly_rate ?? ""),
      retainer_months: String(q.retainer_months ?? 3),
      retainer_deliverables: q.retainer_deliverables?.map((d) => ({
        id: Math.random().toString(36).slice(2),
        type: d.type,
        label: d.label,
        quantity: String(d.quantity),
      })) ?? [],
    };
  }

  function buildPayload(f: QuoteFormState, profile: Profile | null) {
    const lineItems: LineItem[] = f.line_items
      .filter((li) => li.description.trim())
      .map((li) => ({ id: li.id, description: li.description, quantity: parseFloat(li.quantity) || 1, rate: parseFloat(li.rate) || 0 }));

    const packages: QuotePackage[] = f.packages.map((pkg) => {
      const pkgItems: LineItem[] = pkg.line_items
        .filter((li) => li.description.trim())
        .map((li) => ({ id: li.id, description: li.description, quantity: parseFloat(li.quantity) || 1, rate: parseFloat(li.rate) || 0 }));
      const pkgAmount = pkgItems.reduce((s, li) => s + li.quantity * li.rate, 0);
      return { id: pkg.id, name: pkg.name, description: pkg.description || undefined, line_items: pkgItems, amount: pkgAmount, highlighted: pkg.highlighted };
    });

    const retainerDeliverables: RetainerTemplateItem[] = f.retainer_deliverables
      .filter((d) => d.label.trim())
      .map((d) => ({ type: d.type, label: d.label, quantity: parseInt(d.quantity) || 1 }));

    const subtotal = f.use_packages
      ? 0
      : lineItems.reduce((s, li) => s + li.quantity * li.rate, 0);
    const discount = parseFloat(f.discount) || 0;
    const taxRate = parseFloat(f.tax_rate) || 0;
    const amount = f.quote_type === "retainer"
      ? (parseFloat(f.monthly_rate) || 0) * (parseInt(f.retainer_months) || 1)
      : f.use_packages ? 0 : subtotal - discount + (subtotal - discount) * (taxRate / 100);

    return {
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
    };
  }

  async function handleSave(f: QuoteFormState) {
    const payload = buildPayload(f, profile);
    if (editingQuote) {
      const updated = await updateQuote(editingQuote.id, payload);
      onQuotesChange(quotes.map((q) => (q.id === editingQuote.id ? updated : q)));
      toast.success("Quote updated");
    } else {
      const created = await createQuote(payload as Parameters<typeof createQuote>[0]);
      onQuotesChange([created, ...quotes]);
      toast.success("Quote created");
    }
    setShowForm(false);
    setEditingQuote(null);
  }

  async function markSent(q: Quote) {
    const updated = await updateQuote(q.id, {
      status: "sent",
      sent_at: new Date().toISOString(),
      brand_logo_url: profile?.logo_url ?? undefined,
      brand_name: profile?.business_name ?? undefined,
      brand_color: profile?.brand_color ?? undefined,
    });
    onQuotesChange(quotes.map((x) => (x.id === q.id ? updated : x)));
    toast.success("Quote marked as sent — share the link with your client");
  }

  function openEdit(q: Quote) {
    setEditingQuote(q);
    setShowForm(true);
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!quotes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-2xl border border-border bg-card p-5">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-foreground">No quotes yet</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          Send a professional proposal before the project starts — line items, package tiers, and a client acceptance link.
        </p>
        <button
          onClick={() => { setEditingQuote(null); setShowForm(true); }}
          className="mt-5 flex items-center gap-2 rounded-xl bg-[#d4a853] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors"
        >
          <Plus className="h-4 w-4" /> New Quote
        </button>
        <QuoteFormModal open={showForm} onClose={() => setShowForm(false)} onSave={handleSave} projects={projects} profile={profile} quotes={quotes} />
      </div>
    );
  }

  // ── Stats bar ───────────────────────────────────────────────────────────
  const totalSent = quotes.filter((q) => ["sent", "viewed"].includes(q.status)).length;
  const totalAccepted = quotes.filter((q) => q.status === "accepted").length;
  const totalValue = quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + quoteAmount(q), 0);
  const conversionRate = quotes.filter((q) => q.status !== "draft").length
    ? Math.round((totalAccepted / quotes.filter((q) => q.status !== "draft").length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total quotes", value: String(quotes.length), color: "text-foreground" },
          { label: "Pending response", value: String(totalSent), color: "text-blue-400" },
          { label: "Accepted", value: String(totalAccepted), color: "text-emerald-400" },
          { label: "Accepted value", value: fmt(totalValue), color: "text-[#d4a853]" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] text-muted-foreground/70 mb-1">{s.label}</p>
            <p className={`text-lg font-bold font-display ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* List header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{quotes.length} quote{quotes.length !== 1 ? "s" : ""} · {conversionRate}% conversion</p>
        <button
          onClick={() => { setEditingQuote(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-xl bg-[#d4a853] px-4 py-2 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Quote
        </button>
      </div>

      {/* Quotes */}
      <div className="space-y-2">
        {quotes.map((q) => (
          <QuoteRow
            key={q.id}
            quote={q}
            projects={projects}
            onEdit={() => openEdit(q)}
            onDelete={() => onQuotesChange(quotes.filter((x) => x.id !== q.id))}
            onMarkSent={() => markSent(q)}
            onConvert={() => onQuotesChange(quotes.map((x) => x.id === q.id ? { ...x, status: "accepted" } : x))}
            onChange={(updated) => onQuotesChange(quotes.map((x) => x.id === q.id ? updated : x))}
          />
        ))}
      </div>

      <QuoteFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingQuote(null); }}
        onSave={handleSave}
        initial={editingQuote ? formStateFromQuote(editingQuote) : undefined}
        projects={projects}
        profile={profile}
        quotes={quotes}
      />
    </div>
  );
}
