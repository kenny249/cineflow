"use client";

import { useState } from "react";
import {
  X, Printer, Copy, ExternalLink, Loader2, CheckCircle2, Send,
} from "lucide-react";
import { toast } from "sonner";
import type { Invoice, Profile } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);

const TERMS_LABEL: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net15: "Net 15",
  net30: "Net 30",
  net60: "Net 60",
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface InvoiceDocumentProps {
  invoice: Invoice;
  profile: Profile | null;
  onClose: () => void;
  onInvoiceUpdated: (inv: Invoice) => void;
}

export function InvoiceDocument({
  invoice,
  profile,
  onClose,
  onInvoiceUpdated,
}: InvoiceDocumentProps) {
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sending, setSending] = useState(false);

  const appUrl = typeof window !== "undefined"
    ? window.location.origin
    : "https://usecineflow.com";
  const payUrl = `${appUrl}/pay/${invoice.id}`;

  const lineItems = invoice.line_items ?? [];
  const subtotal = lineItems.length > 0
    ? lineItems.reduce((s, li) => s + li.quantity * li.rate, 0)
    : invoice.amount;
  const taxRate = invoice.tax_rate ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const bizName = profile?.business_name || profile?.company || profile?.full_name || "Your Studio";
  const bizEmail = profile?.email ?? "";
  const bizPhone = profile?.business_phone ?? "";
  const bizWebsite = profile?.business_website ?? "";

  // Build structured address, falling back to legacy single-string field
  const addrParts = [
    profile?.address_line1,
    profile?.address_line2,
    [profile?.city, profile?.state, profile?.zip].filter(Boolean).join(", "),
  ].filter(Boolean);
  const bizAddress = addrParts.length > 0 ? addrParts.join(", ") : (profile?.business_address ?? "");

  const paySettings = profile?.payment_settings ?? {};

  // All methods configured in Settings — used to decide what to show in the payment section
  const ps = paySettings as Record<string, string>;
  const configuredMethods: string[] = [];
  if (ps.stripe_secret_key) configuredMethods.push("stripe");
  if (ps.paypal_me_username) configuredMethods.push("paypal");
  if (ps.zelle_contact) configuredMethods.push("zelle");
  if (ps.ach_routing && ps.ach_account) configuredMethods.push("ach");
  if (ps.wire_instructions) configuredMethods.push("wire");
  if (ps.check_payable_to || ps.check_mail_to) configuredMethods.push("check");

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = async () => {
    if (!invoice.payment_link) return;
    try {
      await navigator.clipboard.writeText(invoice.payment_link);
      toast.success("Payment link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleGenerateStripeLink = async () => {
    setGeneratingLink(true);
    try {
      const res = await fetch("/api/invoices/stripe-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate link");
      toast.success("Stripe payment link created");
      onInvoiceUpdated({ ...invoice, payment_link: json.url, payment_method: "stripe" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleGeneratePayPalLink = () => {
    const username = (paySettings as Record<string, string>).paypal_me_username;
    if (!username) {
      toast.error("Add your PayPal.me username in Settings → Payment.");
      return;
    }
    const url = `https://paypal.me/${username}/${total.toFixed(2)}`;
    onInvoiceUpdated({ ...invoice, payment_link: url, payment_method: "paypal" });
    toast.success("PayPal link generated");
  };

  const handleSendInvoice = async () => {
    if (!invoice.client_email) {
      toast.error("Add a client email to this invoice before sending.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send");
      onInvoiceUpdated({ ...invoice, status: invoice.status === "draft" ? "sent" : invoice.status });
      toast.success(`Invoice sent to ${invoice.client_email}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send invoice");
    } finally {
      setSending(false);
    }
  };

  const handleCopyPayUrl = async () => {
    try {
      await navigator.clipboard.writeText(payUrl);
      toast.success("Pay link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <>
      {/* ── Print styles ──────────────────────────────────────── */}
      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          .invoice-print-root { display: block !important; position: fixed; inset: 0; z-index: 9999; background: white; }
          .invoice-no-print { display: none !important; }
        }
      `}</style>

      {/* ── Modal overlay ─────────────────────────────────────── */}
      <div className="invoice-print-root fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">

        {/* Toolbar */}
        <div className="invoice-no-print flex shrink-0 items-center justify-between border-b border-white/10 bg-black/60 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
            Invoice Preview
          </span>
          <div className="flex items-center gap-2">
            {/* Copy pay link */}
            <button
              type="button"
              onClick={handleCopyPayUrl}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20 transition-colors"
              title="Copy client pay link"
            >
              <Copy className="h-3.5 w-3.5" /> Copy Link
            </button>
            {/* Send email */}
            {invoice.status !== "paid" && (
              <button
                type="button"
                onClick={handleSendInvoice}
                disabled={sending}
                className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/40 bg-[#d4a853]/20 px-3 py-1.5 text-xs font-semibold text-[#d4a853] hover:bg-[#d4a853]/30 transition-colors disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? "Sending…" : "Send to Client"}
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/20 bg-white/10 p-1.5 text-white/80 hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Document */}
        <div className="flex-1 overflow-y-auto py-8 px-4">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white text-zinc-900 shadow-2xl overflow-hidden">

            {/* Header band */}
            <div className="flex items-start justify-between bg-zinc-900 px-10 py-8">
              <div>
                <p className="text-xl font-bold text-white">{bizName}</p>
                {bizAddress && <p className="mt-1 text-xs text-zinc-400">{bizAddress}</p>}
                {bizPhone && <p className="text-xs text-zinc-400">{bizPhone}</p>}
                {bizEmail && <p className="text-xs text-zinc-400">{bizEmail}</p>}
                {bizWebsite && <p className="text-xs text-zinc-400">{bizWebsite}</p>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-black tracking-tight text-[#d4a853]">INVOICE</p>
                <p className="mt-1 font-mono text-sm font-semibold text-white">{invoice.invoice_number}</p>
                <p className="mt-3 text-xs text-zinc-400">
                  Issued: {formatDate(invoice.created_at?.split("T")[0])}
                </p>
                {invoice.due_date && (
                  <p className="text-xs text-zinc-400">Due: {formatDate(invoice.due_date)}</p>
                )}
                {invoice.payment_terms && (
                  <p className="mt-1 text-xs font-semibold text-[#d4a853]">
                    {TERMS_LABEL[invoice.payment_terms] ?? invoice.payment_terms}
                  </p>
                )}
              </div>
            </div>

            {/* Bill To */}
            <div className="border-b border-zinc-100 bg-zinc-50 px-10 py-6">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Bill To
              </p>
              <p className="text-base font-semibold text-zinc-900">
                {invoice.client_name || "Client"}
              </p>
              {invoice.description && (
                <p className="mt-1 text-sm text-zinc-500">{invoice.description}</p>
              )}
            </div>

            {/* Line Items */}
            <div className="px-10 py-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Description
                    </th>
                    <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-16">
                      Qty
                    </th>
                    <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-28">
                      Rate
                    </th>
                    <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-28">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length > 0 ? (
                    lineItems.map((li, i) => (
                      <tr key={li.id ?? i} className="border-b border-zinc-100">
                        <td className="py-3 pr-4 text-zinc-800">{li.description || "—"}</td>
                        <td className="py-3 text-right text-zinc-600">{li.quantity}</td>
                        <td className="py-3 text-right text-zinc-600">{fmt(li.rate)}</td>
                        <td className="py-3 text-right font-medium text-zinc-900">
                          {fmt(li.quantity * li.rate)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-b border-zinc-100">
                      <td className="py-3 text-zinc-800">
                        {invoice.description || "Services rendered"}
                      </td>
                      <td className="py-3 text-right text-zinc-600">1</td>
                      <td className="py-3 text-right text-zinc-600">{fmt(invoice.amount)}</td>
                      <td className="py-3 text-right font-medium text-zinc-900">
                        {fmt(invoice.amount)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  {lineItems.length > 0 && (
                    <div className="flex justify-between text-sm text-zinc-600">
                      <span>Subtotal</span>
                      <span>{fmt(subtotal)}</span>
                    </div>
                  )}
                  {taxRate > 0 && (
                    <div className="flex justify-between text-sm text-zinc-600">
                      <span>Tax ({taxRate}%)</span>
                      <span>{fmt(taxAmount)}</span>
                    </div>
                  )}
                  {invoice.amount_paid > 0 && invoice.status !== "paid" && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Amount Paid</span>
                      <span>−{fmt(invoice.amount_paid)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold text-zinc-900">
                    <span>
                      {invoice.status === "paid"
                        ? "Total Paid"
                        : invoice.amount_paid > 0
                        ? "Balance Due"
                        : "Total Due"}
                    </span>
                    <span>
                      {fmt(
                        invoice.status === "paid"
                          ? total
                          : total - (invoice.amount_paid ?? 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Section */}
            <div className="border-t border-zinc-100 px-10 py-6">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Payment
              </p>

              {invoice.status === "paid" ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Paid in full</span>
                  {invoice.paid_date && (
                    <span className="text-sm text-zinc-400">— {formatDate(invoice.paid_date)}</span>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active Stripe payment link */}
                  {invoice.payment_link ? (
                    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-0.5">Pay by Card (Stripe)</p>
                        <p className="truncate font-mono text-xs text-zinc-700">{invoice.payment_link}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="invoice-no-print shrink-0 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 hover:text-zinc-900 transition-colors"
                        title="Copy link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={invoice.payment_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="invoice-no-print shrink-0 flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
                      >
                        Pay Now <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : null}

                  {/* Generate link buttons (not printed) */}
                  {(configuredMethods.includes("stripe") || configuredMethods.includes("paypal")) && (
                    <div className="invoice-no-print flex flex-wrap gap-2">
                      {configuredMethods.includes("stripe") && !invoice.payment_link && ps.stripe_secret_key && (
                        <button
                          type="button"
                          onClick={handleGenerateStripeLink}
                          disabled={generatingLink}
                          className="flex items-center gap-1.5 rounded-lg bg-[#635bff] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4f46e5] transition-colors disabled:opacity-60"
                        >
                          {generatingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          Generate Stripe Link
                        </button>
                      )}
                      {configuredMethods.includes("paypal") && !invoice.payment_link && ps.paypal_me_username && (
                        <button
                          type="button"
                          onClick={handleGeneratePayPalLink}
                          className="flex items-center gap-1.5 rounded-lg bg-[#003087] px-3 py-2 text-xs font-semibold text-white hover:bg-[#002570] transition-colors"
                        >
                          Generate PayPal Link
                        </button>
                      )}
                    </div>
                  )}

                  {/* Manual payment instructions — all configured methods */}
                  {configuredMethods.includes("zelle") && ps.zelle_contact && (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pay via Zelle</p>
                      <p className="text-sm font-medium text-zinc-800">{ps.zelle_contact}</p>
                    </div>
                  )}
                  {configuredMethods.includes("ach") && (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">ACH Bank Transfer</p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                        {ps.ach_bank_name && (<><span className="text-zinc-400">Bank</span><span className="font-medium text-zinc-800">{ps.ach_bank_name}</span></>)}
                        {ps.ach_routing && (<><span className="text-zinc-400">Routing</span><span className="font-mono font-medium text-zinc-800">{ps.ach_routing}</span></>)}
                        {ps.ach_account && (<><span className="text-zinc-400">Account</span><span className="font-mono font-medium text-zinc-800">{ps.ach_account}</span></>)}
                      </div>
                    </div>
                  )}
                  {configuredMethods.includes("wire") && ps.wire_instructions && (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Wire Transfer</p>
                      <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-700">{ps.wire_instructions}</pre>
                    </div>
                  )}
                  {configuredMethods.includes("check") && (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pay by Check</p>
                      {ps.check_payable_to && (
                        <p className="text-sm text-zinc-700">Make payable to: <span className="font-semibold">{ps.check_payable_to}</span></p>
                      )}
                      {ps.check_mail_to && (
                        <p className="text-sm text-zinc-700">Mail to: <span className="font-semibold">{ps.check_mail_to}</span></p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="border-t border-zinc-100 px-10 py-6">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Notes</p>
                <p className="text-sm text-zinc-600">{invoice.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-zinc-100 bg-zinc-50 px-10 py-4">
              <p className="text-center text-xs text-zinc-400">
                Thank you for your business — {bizName}
                {bizEmail ? ` · ${bizEmail}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
