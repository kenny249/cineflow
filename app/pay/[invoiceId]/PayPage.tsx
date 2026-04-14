"use client";

import type { Invoice, PaymentSettings } from "@/types";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const TERMS_LABEL: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net15: "Net 15",
  net30: "Net 30",
  net60: "Net 60",
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); toast.success("Copied"); }
        catch { toast.error("Could not copy"); }
      }}
      className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
    >
      <Copy className="h-3 w-3" /> Copy
    </button>
  );
}

// ─── Single method block ──────────────────────────────────────────────────────

function SingleMethodBlock({
  method,
  invoice,
  total,
  biz,
}: {
  method: string;
  invoice: Invoice;
  total: number;
  biz: PayPageProps["biz"];
}) {
  const ps = biz.payment_settings as Record<string, string>;

  if (method === "stripe") {
    const link = invoice.payment_link;
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pay by Card</p>
        <p className="mb-4 text-sm text-zinc-600">Securely pay by credit card, Apple Pay, or Google Pay.</p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Pay {fmt(total)} Now
          </a>
        ) : (
          <p className="text-sm text-zinc-500 italic">Payment link not yet available — contact {biz.email || "the sender"}.</p>
        )}
      </div>
    );
  }

  if (method === "paypal") {
    const link = invoice.payment_link || (ps.paypal_me_username ? `https://paypal.me/${ps.paypal_me_username}/${total.toFixed(2)}` : null);
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pay via PayPal</p>
        <p className="mb-4 text-sm text-zinc-600">Pay via PayPal — no account required.</p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Pay {fmt(total)} via PayPal
          </a>
        ) : (
          <p className="text-sm text-zinc-500 italic">Contact {biz.email || "the sender"} for PayPal details.</p>
        )}
      </div>
    );
  }

  if (method === "zelle") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 space-y-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pay via Zelle</p>
        {ps.zelle_contact && (
          <div className="flex items-center text-sm text-zinc-700">
            <span className="w-16 shrink-0 text-zinc-400">Send to</span>
            <span className="font-medium">{ps.zelle_contact}</span>
            <CopyButton text={ps.zelle_contact} />
          </div>
        )}
        <div className="flex items-center text-sm text-zinc-700">
          <span className="w-16 shrink-0 text-zinc-400">Amount</span>
          <span className="font-medium">{fmt(total)}</span>
          <CopyButton text={total.toFixed(2)} />
        </div>
        <div className="flex items-center text-sm text-zinc-700">
          <span className="w-16 shrink-0 text-zinc-400">Memo</span>
          <span className="font-medium">{invoice.invoice_number}</span>
        </div>
      </div>
    );
  }

  if (method === "ach") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 space-y-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">ACH / Bank Transfer</p>
        {ps.ach_bank_name && (
          <div className="flex items-center text-sm text-zinc-700">
            <span className="w-24 shrink-0 text-zinc-400">Bank</span>
            <span className="font-medium">{ps.ach_bank_name}</span>
          </div>
        )}
        {ps.ach_routing && (
          <div className="flex items-center text-sm text-zinc-700">
            <span className="w-24 shrink-0 text-zinc-400">Routing #</span>
            <span className="font-mono font-medium">{ps.ach_routing}</span>
            <CopyButton text={ps.ach_routing} />
          </div>
        )}
        {ps.ach_account && (
          <div className="flex items-center text-sm text-zinc-700">
            <span className="w-24 shrink-0 text-zinc-400">Account #</span>
            <span className="font-mono font-medium">{ps.ach_account}</span>
            <CopyButton text={ps.ach_account} />
          </div>
        )}
        <div className="flex items-center text-sm text-zinc-700">
          <span className="w-24 shrink-0 text-zinc-400">Amount</span>
          <span className="font-medium">{fmt(total)}</span>
        </div>
        <div className="flex items-center text-sm text-zinc-700">
          <span className="w-24 shrink-0 text-zinc-400">Reference</span>
          <span className="font-medium">{invoice.invoice_number}</span>
        </div>
      </div>
    );
  }

  if (method === "wire") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Wire Transfer</p>
        {ps.wire_instructions ? (
          <pre className="whitespace-pre-wrap text-sm text-zinc-700 font-sans">{ps.wire_instructions}</pre>
        ) : (
          <p className="text-sm text-zinc-500 italic">Contact {biz.email || "the sender"} for wire instructions.</p>
        )}
      </div>
    );
  }

  if (method === "check") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 space-y-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pay by Check</p>
        {ps.check_payable_to && (
          <div className="flex items-center text-sm text-zinc-700">
            <span className="w-24 shrink-0 text-zinc-400">Payable to</span>
            <span className="font-medium">{ps.check_payable_to}</span>
          </div>
        )}
        {ps.check_mail_to && (
          <div className="flex items-start text-sm text-zinc-700">
            <span className="w-24 shrink-0 text-zinc-400">Mail to</span>
            <span className="font-medium whitespace-pre-wrap">{ps.check_mail_to}</span>
          </div>
        )}
        <div className="flex items-center text-sm text-zinc-700">
          <span className="w-24 shrink-0 text-zinc-400">Amount</span>
          <span className="font-medium">{fmt(total)}</span>
        </div>
        <div className="flex items-center text-sm text-zinc-700">
          <span className="w-24 shrink-0 text-zinc-400">Memo</span>
          <span className="font-medium">{invoice.invoice_number}</span>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Payment section (all methods) ───────────────────────────────────────────

function PaymentSection({
  invoice,
  total,
  biz,
}: {
  invoice: Invoice;
  total: number;
  biz: PayPageProps["biz"];
}) {
  // Use all configured methods from seller's Settings.
  // Fall back to per-invoice methods for backwards compat with old invoices.
  const methods = biz.configured_methods?.length
    ? biz.configured_methods
    : invoice.accepted_payment_methods?.length
    ? invoice.accepted_payment_methods
    : invoice.payment_method ? [invoice.payment_method] : [];

  if (methods.length === 0) return null;

  return (
    <div className="space-y-3">
      {methods.length > 1 && (
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1">
          Choose a payment method
        </p>
      )}
      {methods.map((method) => (
        <SingleMethodBlock key={method} method={method} invoice={invoice} total={total} biz={biz} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PayPageProps {
  invoice: Invoice;
  biz: {
    name: string;
    email: string;
    phone: string;
    address: string;
    website: string;
    configured_methods: string[];
    payment_settings: Omit<PaymentSettings, "stripe_secret_key" | "resend_api_key">;
  };
}

export function PayPage({ invoice, biz }: PayPageProps) {
  const lineItems = invoice.line_items ?? [];
  const subtotal = lineItems.length > 0
    ? lineItems.reduce((s, li) => s + li.quantity * li.rate, 0)
    : invoice.amount;
  const taxRate = invoice.tax_rate ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const isPaid = invoice.status === "paid";

  return (
    <div className="min-h-screen bg-zinc-100 py-10 px-4">
      <div className="mx-auto max-w-2xl">

        {/* Invoice document card */}
        <div className="rounded-2xl bg-white shadow-xl overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between bg-zinc-900 px-10 py-8">
            <div>
              <p className="text-xl font-bold text-white">{biz.name}</p>
              {biz.address && <p className="mt-1 text-xs text-zinc-400">{biz.address}</p>}
              {biz.phone && <p className="text-xs text-zinc-400">{biz.phone}</p>}
              {biz.email && <p className="text-xs text-zinc-400">{biz.email}</p>}
              {biz.website && <p className="text-xs text-zinc-400">{biz.website}</p>}
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
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Bill To</p>
            <p className="text-base font-semibold text-zinc-900">{invoice.client_name || "Client"}</p>
            {invoice.description && (
              <p className="mt-1 text-sm text-zinc-500">{invoice.description}</p>
            )}
          </div>

          {/* Line Items */}
          <div className="px-10 py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">Description</th>
                  <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-16">Qty</th>
                  <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-28">Rate</th>
                  <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length > 0 ? (
                  lineItems.map((li, i) => (
                    <tr key={li.id ?? i} className="border-b border-zinc-100">
                      <td className="py-3 pr-4 text-zinc-800">{li.description || "—"}</td>
                      <td className="py-3 text-right text-zinc-600">{li.quantity}</td>
                      <td className="py-3 text-right text-zinc-600">{fmt(li.rate)}</td>
                      <td className="py-3 text-right font-medium text-zinc-900">{fmt(li.quantity * li.rate)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b border-zinc-100">
                    <td className="py-3 text-zinc-800">{invoice.description || "Services rendered"}</td>
                    <td className="py-3 text-right text-zinc-600">1</td>
                    <td className="py-3 text-right text-zinc-600">{fmt(invoice.amount)}</td>
                    <td className="py-3 text-right font-medium text-zinc-900">{fmt(invoice.amount)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2">
                {lineItems.length > 0 && (
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Subtotal</span><span>{fmt(subtotal)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Tax ({taxRate}%)</span><span>{fmt(taxAmount)}</span>
                  </div>
                )}
                {invoice.amount_paid > 0 && !isPaid && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Amount Paid</span><span>−{fmt(invoice.amount_paid)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold text-zinc-900">
                  <span>{isPaid ? "Total Paid" : invoice.amount_paid > 0 ? "Balance Due" : "Total Due"}</span>
                  <span>{fmt(isPaid ? total : total - invoice.amount_paid)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="border-t border-zinc-100 px-10 pb-6 pt-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Notes</p>
              <p className="text-sm text-zinc-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Payment section */}
        <div className="mt-6">
          {isPaid ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-800">This invoice has been paid</p>
                {invoice.paid_date && (
                  <p className="text-sm text-emerald-600">Paid on {formatDate(invoice.paid_date)}</p>
                )}
              </div>
            </div>
          ) : (
            <PaymentSection invoice={invoice} total={total - invoice.amount_paid} biz={biz} />
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Powered by <span className="font-semibold text-zinc-500">Cineflow</span>
        </p>
      </div>
    </div>
  );
}
