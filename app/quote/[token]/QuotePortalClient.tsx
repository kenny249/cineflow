"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Star, ExternalLink } from "lucide-react";
import type { Quote, QuotePackage } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function isExpired(q: Quote): boolean {
  if (!q.valid_until) return false;
  return new Date(q.valid_until) < new Date(new Date().toDateString());
}

function paymentTermsLabel(pt?: string) {
  const map: Record<string, string> = {
    due_on_receipt: "Due on receipt",
    net15: "Net 15 days",
    net30: "Net 30 days",
    net60: "Net 60 days",
  };
  return pt ? (map[pt] ?? pt) : null;
}

// ─── Acceptance modal ─────────────────────────────────────────────────────────

function AcceptModal({
  quoteNumber,
  accentColor,
  onAccept,
  onClose,
}: {
  quoteNumber: string;
  accentColor: string;
  onAccept: (name: string, email: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onAccept(name.trim(), email.trim());
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] p-6 shadow-2xl">
        {done ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}60` }}>
              <Check className="h-7 w-7" style={{ color: accentColor }} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Quote Accepted</h3>
            <p className="text-sm text-zinc-400">Thank you, {name}! Your acceptance has been recorded. The team will be in touch shortly to get started.</p>
            <button onClick={onClose} className="mt-5 rounded-xl px-6 py-2.5 text-sm font-semibold text-black transition-colors" style={{ background: accentColor }}>
              Close
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-base font-bold text-white mb-1">Accept Quote {quoteNumber}</h3>
            <p className="text-xs text-zinc-500 mb-5">By clicking Accept, you confirm your intent to move forward with this proposal.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Your full name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Sarah Chen"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Email address</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="sarah@company.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/20"
                />
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-[color:var(--accent)]"
                />
                <span className="text-xs text-zinc-400 leading-relaxed">
                  I have reviewed this quote and confirm my intent to move forward with the proposed scope and pricing.
                </span>
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!agreed || !name.trim() || submitting}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-black disabled:opacity-40 transition-colors"
                  style={{ background: accentColor }}
                >
                  {submitting ? "Submitting…" : "Accept Quote"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Package card ─────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  selected,
  accentColor,
  onSelect,
}: {
  pkg: QuotePackage;
  selected: boolean;
  accentColor: string;
  onSelect: () => void;
}) {
  return (
    <div
      className="relative flex flex-col rounded-2xl border p-5 cursor-pointer transition-all duration-200"
      style={{
        borderColor: selected ? accentColor : pkg.highlighted ? `${accentColor}50` : "rgba(255,255,255,0.1)",
        background: selected ? `${accentColor}12` : pkg.highlighted ? `${accentColor}08` : "rgba(255,255,255,0.03)",
        boxShadow: selected ? `0 0 0 2px ${accentColor}50` : "none",
      }}
      onClick={onSelect}
    >
      {pkg.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black" style={{ background: accentColor }}>
          <Star className="h-2.5 w-2.5" /> Recommended
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-bold text-white text-base">{pkg.name}</h3>
        <div className="rounded-full h-5 w-5 border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors" style={{ borderColor: selected ? accentColor : "rgba(255,255,255,0.2)", background: selected ? accentColor : "transparent" }}>
          {selected && <Check className="h-3 w-3 text-black" />}
        </div>
      </div>
      {pkg.description && <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{pkg.description}</p>}
      <div className="space-y-1.5 flex-1 mb-4">
        {pkg.line_items.map((li, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-zinc-300">{li.description}{li.quantity > 1 ? ` ×${li.quantity}` : ""}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-3 border-t border-white/10">
        <p className="text-2xl font-display font-bold" style={{ color: accentColor }}>{fmt(pkg.amount)}</p>
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function QuotePortalClient({ quote }: { quote: Quote }) {
  const accentColor = quote.brand_color || "#d4a853";
  const expired = isExpired(quote);
  const alreadyActed = ["accepted", "declined"].includes(quote.status);

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    quote.packages?.find((p) => p.highlighted)?.id ?? quote.packages?.[0]?.id ?? null
  );
  const [showAccept, setShowAccept] = useState(false);
  const [accepted, setAccepted] = useState(quote.status === "accepted");
  const [declined, setDeclined] = useState(quote.status === "declined");
  const viewTracked = useRef(false);

  // Track view on load
  useEffect(() => {
    if (viewTracked.current || alreadyActed) return;
    viewTracked.current = true;
    fetch("/api/quotes/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: quote.token }),
    }).catch(() => {});
  }, [quote.token, alreadyActed]);

  async function handleAccept(name: string, email: string) {
    const res = await fetch("/api/quotes/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: quote.token, name, email, selectedPackageId }),
    });
    if (!res.ok) throw new Error("Failed to submit acceptance");
    setAccepted(true);
  }

  async function handleDecline() {
    if (!confirm("Are you sure you want to decline this quote?")) return;
    await fetch("/api/quotes/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: quote.token, declined: true }),
    });
    setDeclined(true);
  }

  const hasPackages = (quote.packages?.length ?? 0) > 0;
  const hasLineItems = !hasPackages && (quote.line_items?.length ?? 0) > 0;

  const subtotal = hasLineItems
    ? (quote.line_items ?? []).reduce((s, li) => s + li.quantity * li.rate, 0)
    : 0;
  const discount = quote.discount ?? 0;
  const taxRate = quote.tax_rate ?? 0;
  const taxAmount = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + taxAmount;

  const retainerTotal = quote.quote_type === "retainer"
    ? (quote.monthly_rate ?? 0) * (quote.retainer_months ?? 1)
    : 0;

  return (
    <div className="min-h-screen bg-[#090909] text-white" style={{ "--accent": accentColor } as React.CSSProperties}>
      {/* Top bar */}
      <div className="border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {quote.brand_logo_url ? (
            <img src={quote.brand_logo_url} alt={quote.brand_name ?? "Logo"} className="h-7 max-w-[120px] object-contain" />
          ) : (
            <span className="text-sm font-bold text-white">{quote.brand_name ?? "Cineflow"}</span>
          )}
        </div>
        <span className="font-mono text-xs text-zinc-500">{quote.quote_number}</span>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-10 space-y-10">
        {/* ── Hero ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
            {quote.quote_type === "retainer" ? "Retainer Proposal" : "Project Quote"}
          </p>
          <h1 className="font-display text-3xl font-bold text-white leading-tight">
            {quote.description || `Quote for ${quote.client_name || "You"}`}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400 pt-1">
            {quote.client_name && <span>Prepared for <span className="text-white font-medium">{quote.client_name}</span></span>}
            {quote.valid_until && (
              <span className={expired ? "text-amber-400" : ""}>
                {expired ? "⚠ Expired" : "Valid until"} {formatDate(quote.valid_until)}
              </span>
            )}
          </div>
        </div>

        {/* ── Status banners ── */}
        {accepted && (
          <div className="flex items-center gap-3 rounded-2xl border px-5 py-4" style={{ borderColor: `${accentColor}40`, background: `${accentColor}10` }}>
            <Check className="h-5 w-5 shrink-0" style={{ color: accentColor }} />
            <div>
              <p className="font-semibold text-white text-sm">Quote Accepted</p>
              {quote.accepted_name && <p className="text-xs text-zinc-400 mt-0.5">Accepted by {quote.accepted_name}{quote.accepted_email ? ` · ${quote.accepted_email}` : ""}</p>}
            </div>
          </div>
        )}
        {declined && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
            <p className="font-semibold text-red-400 text-sm">This quote was declined.</p>
          </div>
        )}
        {expired && !accepted && !declined && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
            <p className="text-sm font-semibold text-amber-400">This quote has expired. Please contact us to request an updated proposal.</p>
          </div>
        )}

        {/* ── Scope of work ── */}
        {quote.scope_of_work && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Scope of Work</h2>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{quote.scope_of_work}</p>
          </div>
        )}

        {/* ── Packages ── */}
        {hasPackages && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Choose a Package</h2>
            <div className={`grid gap-4 ${quote.packages!.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              {quote.packages!.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  selected={selectedPackageId === pkg.id}
                  accentColor={accentColor}
                  onSelect={() => setSelectedPackageId(pkg.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Line items ── */}
        {hasLineItems && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Deliverables</h2>
            <div className="rounded-2xl border border-white/8 overflow-hidden divide-y divide-white/5">
              {quote.line_items!.map((li, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm">
                  <span className="text-zinc-200">{li.description}</span>
                  <div className="flex items-baseline gap-3 shrink-0 text-right">
                    <span className="text-zinc-500 text-xs">×{li.quantity}</span>
                    <span className="text-white font-medium">{fmt(li.quantity * li.rate)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 rounded-2xl border border-white/8 px-5 py-4 text-sm">
              <div className="flex justify-between text-zinc-400"><span>Subtotal</span><span>{fmtFull(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>−{fmtFull(discount)}</span></div>}
              {taxAmount > 0 && <div className="flex justify-between text-zinc-400"><span>Tax ({taxRate}%)</span><span>{fmtFull(taxAmount)}</span></div>}
              <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold text-white">
                <span>Total</span>
                <span style={{ color: accentColor }}>{fmtFull(total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Retainer details ── */}
        {quote.quote_type === "retainer" && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Retainer Details</h2>
            <div className="rounded-2xl border border-white/8 divide-y divide-white/5 overflow-hidden">
              {quote.retainer_deliverables?.map((d, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-200">{d.label}</span>
                  <span className="text-zinc-400">×{d.quantity} / month</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/8 px-5 py-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-zinc-400"><span>Monthly rate</span><span>{fmtFull(quote.monthly_rate ?? 0)}</span></div>
              {quote.retainer_months && <div className="flex justify-between text-zinc-400"><span>Contract length</span><span>{quote.retainer_months} month{quote.retainer_months !== 1 ? "s" : ""}</span></div>}
              <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold text-white">
                <span>Total value</span>
                <span style={{ color: accentColor }}>{fmtFull(retainerTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Terms ── */}
        {quote.payment_terms && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="text-zinc-600">Payment terms:</span>
            <span>{paymentTermsLabel(quote.payment_terms)}</span>
          </div>
        )}

        {/* ── CTA ── */}
        {!accepted && !declined && !expired && (
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setShowAccept(true)}
              className="flex w-full items-center justify-center rounded-2xl py-4 text-base font-bold text-black shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: accentColor }}
            >
              Accept This Quote
            </button>
            <button
              onClick={handleDecline}
              className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-2"
            >
              Decline this quote
            </button>
          </div>
        )}

        {/* ── Footer — Built by Cineflow ── */}
        <div className="border-t border-white/5 pt-8 flex flex-col items-center gap-2 text-center">
          <a
            href="https://www.usecineflow.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Built by <span className="font-semibold text-zinc-400">Cineflow</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-[10px] text-zinc-700">Professional tools for filmmakers</p>
        </div>
      </div>

      {showAccept && (
        <AcceptModal
          quoteNumber={quote.quote_number}
          accentColor={accentColor}
          onAccept={handleAccept}
          onClose={() => setShowAccept(false)}
        />
      )}
    </div>
  );
}
