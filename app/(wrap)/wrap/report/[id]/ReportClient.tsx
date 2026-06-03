"use client";

import { useState } from "react";
import { Receipt, Utensils, Plane, Bed, Camera, Package, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  food: Utensils, travel: Plane, accommodation: Bed, equipment: Camera, other: Package,
};
const CATEGORY_LABELS: Record<string, string> = {
  food: "Food & Drink", travel: "Travel", accommodation: "Hotel", equipment: "Equipment", other: "Other",
};

function formatAmount(a: number | null, c = "USD") {
  if (a == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(a);
}
function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

interface ReceiptItem {
  id: string; vendor: string | null; amount: number | null;
  currency: string; date: string | null; category: string | null; description: string | null;
}
interface Trip {
  id: string; name: string; client_name: string | null;
  client_email: string | null; notes: string | null; status: string;
}

export function ReportClient({
  trip,
  receipts,
  optimisticPaid = false,
}: {
  trip: Trip;
  receipts: ReceiptItem[];
  optimisticPaid?: boolean;
}) {
  const [paying, setPaying] = useState(false);
  const total = receipts.reduce((s, r) => s + (r.amount ?? 0), 0);
  const isPaid = trip.status === "paid" || optimisticPaid;

  async function handlePay() {
    setPaying(true);
    const res = await fetch(`/api/wrap/trips/${trip.id}/checkout`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.url) {
      toast.error("Payment setup failed — please try again.");
      setPaying(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Receipt className="h-5 w-5 text-[#d4a853]" />
          </div>
          <div>
            <p className="text-[9px] font-bold tracking-[0.3em] text-[#d4a853] uppercase">Expense Report · Wrap</p>
            <h1 className="text-lg font-bold text-white">{trip.name}</h1>
          </div>
        </div>

        {trip.client_name && (
          <p className="mb-6 text-sm text-zinc-400">
            Submitted to <span className="font-medium text-white">{trip.client_name}</span>
          </p>
        )}

        {/* Total */}
        <div className={`mb-6 rounded-2xl border p-6 ${isPaid ? "border-emerald-500/20 bg-emerald-500/8" : "border-[#d4a853]/20 bg-[#d4a853]/8"}`}>
          {isPaid ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wider">Payment received</p>
                <p className="text-2xl font-bold text-white">{formatAmount(total)}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Total due</p>
              <p className="text-3xl font-bold text-white">{formatAmount(total)}</p>
              <p className="mt-1 text-xs text-zinc-500">{receipts.length} expense{receipts.length !== 1 ? "s" : ""}</p>
            </>
          )}
        </div>

        {/* Receipt breakdown */}
        <div className="mb-6 rounded-2xl border border-white/[0.06] bg-[#111] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Expense breakdown</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {receipts.map((r) => {
              const Icon = CATEGORY_ICONS[r.category ?? "other"] ?? Package;
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{r.vendor ?? "Unknown vendor"}</p>
                    <p className="text-[11px] text-zinc-500">
                      {CATEGORY_LABELS[r.category ?? "other"]}
                      {r.date ? ` · ${formatDate(r.date)}` : ""}
                    </p>
                    {r.description && <p className="text-[11px] text-zinc-600 truncate">{r.description}</p>}
                  </div>
                  <p className="text-sm font-semibold text-white shrink-0">{formatAmount(r.amount, r.currency)}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
            <p className="text-sm font-bold text-white">Total</p>
            <p className="text-lg font-bold text-white">{formatAmount(total)}</p>
          </div>
        </div>

        {trip.notes && (
          <div className="mb-6 rounded-xl border border-white/[0.06] bg-[#111] px-4 py-3.5">
            <p className="text-xs text-zinc-500 mb-1">Notes</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{trip.notes}</p>
          </div>
        )}

        {/* Pay button */}
        {!isPaid && receipts.length > 0 && (
          <button
            onClick={handlePay}
            disabled={paying}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-4 text-base font-bold text-black transition hover:bg-[#d4a853]/90 disabled:opacity-60"
          >
            {paying ? <><Loader2 className="h-5 w-5 animate-spin" /> Redirecting…</> : `Pay ${formatAmount(total)}`}
          </button>
        )}

        <p className="mt-6 text-center text-[11px] text-zinc-600">
          Powered by <span className="text-zinc-500">Wrap by CineFlow</span>
        </p>
      </div>
    </div>
  );
}
