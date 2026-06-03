"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Plus, Loader2, Trash2, Send, CheckCircle2,
  Copy, Utensils, Plane, Bed, Camera, Package, ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  food: Utensils, travel: Plane, accommodation: Bed, equipment: Camera, other: Package,
};
const CATEGORY_COLORS: Record<string, string> = {
  food: "text-orange-400", travel: "text-blue-400", accommodation: "text-purple-400",
  equipment: "text-[#d4a853]", other: "text-zinc-400",
};

interface Receipt {
  id: string; vendor: string | null; amount: number | null;
  currency: string; date: string | null; category: string | null;
  description: string | null; created_at: string;
}
interface Trip {
  id: string; name: string; client_name: string | null;
  client_email: string | null; notes: string | null;
  status: "open" | "sent" | "paid"; created_at: string;
}

function formatAmount(a: number | null, c = "USD") {
  if (a == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(a);
}
function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/wrap"); return; }

    const [{ data: tripData }, { data: receiptData }] = await Promise.all([
      supabase.from("wrap_trips").select("*").eq("id", id).eq("user_id", user.id).single(),
      supabase.from("wrap_receipts").select("*").eq("trip_id", id).order("created_at", { ascending: false }),
    ]);

    if (!tripData) { toast.error("Trip not found."); router.replace("/wrap/dashboard"); return; }
    setTrip(tripData);
    setReceipts(receiptData ?? []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(receiptId: string) {
    setDeleting(receiptId);
    const { error } = await createClient().from("wrap_receipts").delete().eq("id", receiptId);
    if (error) { toast.error("Delete failed."); setDeleting(null); return; }
    setReceipts((r) => r.filter((x) => x.id !== receiptId));
    setDeleting(null);
  }

  async function handleSendReport() {
    if (!trip) return;
    setSending(true);
    // Mark as sent
    await createClient().from("wrap_trips").update({ status: "sent" }).eq("id", id);
    setTrip((t) => t && { ...t, status: "sent" });

    const reportUrl = `${window.location.origin}/wrap/report/${id}`;

    // Copy link to clipboard
    await navigator.clipboard.writeText(reportUrl).catch(() => {});
    toast.success("Report link copied! Share it with your client.");
    setSending(false);
  }

  function copyLink() {
    const url = `${window.location.origin}/wrap/report/${id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied!"));
  }

  const total = receipts.reduce((s, r) => s + (r.amount ?? 0), 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (!trip) return null;

  const isPaid = trip.status === "paid";
  const isSent = trip.status === "sent";

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="truncate text-sm font-semibold text-white flex-1">{trip.name}</p>
        {isPaid && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Paid
          </span>
        )}
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Trip meta */}
        {(trip.client_name || trip.notes) && (
          <div className="rounded-xl border border-white/[0.06] bg-[#111] px-4 py-3.5 space-y-1">
            {trip.client_name && (
              <p className="text-xs text-zinc-400">Client: <span className="text-white font-medium">{trip.client_name}</span></p>
            )}
            {trip.client_email && (
              <p className="text-xs text-zinc-400">Email: <span className="text-white">{trip.client_email}</span></p>
            )}
            {trip.notes && <p className="text-xs text-zinc-500 italic">{trip.notes}</p>}
          </div>
        )}

        {/* Total */}
        <div className={`rounded-2xl border p-5 ${isPaid ? "border-emerald-500/20 bg-emerald-500/8" : "border-[#d4a853]/20 bg-[#d4a853]/8"}`}>
          <p className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Total expenses</p>
          <p className="text-3xl font-bold text-white">{formatAmount(total)}</p>
          <p className="mt-1 text-xs text-zinc-500">{receipts.length} receipt{receipts.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Receipts */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Receipts</p>
          {receipts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center rounded-xl border border-dashed border-white/10">
              <p className="text-sm text-zinc-500">No receipts yet.</p>
              <button
                onClick={() => router.push(`/wrap/upload?trip=${id}`)}
                className="mt-1 text-xs text-[#d4a853] hover:underline"
              >
                Add first receipt
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {receipts.map((r) => {
                const Icon = CATEGORY_ICONS[r.category ?? "other"] ?? Package;
                const color = CATEGORY_COLORS[r.category ?? "other"] ?? "text-zinc-400";
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#111] px-4 py-3">
                    <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{r.vendor ?? "Unknown"}</p>
                      {r.date && <p className="text-[11px] text-zinc-500">{formatDate(r.date)}</p>}
                    </div>
                    <p className="text-sm font-semibold text-white">{formatAmount(r.amount, r.currency)}</p>
                    {!isPaid && (
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deleting === r.id}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        {deleting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Report link (if sent or paid) */}
        {(isSent || isPaid) && (
          <div className="rounded-xl border border-white/[0.06] bg-[#111] px-4 py-3.5">
            <p className="text-xs text-zinc-500 mb-2">Expense report link</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 truncate text-xs text-zinc-300 font-mono">
                {`${typeof window !== "undefined" ? window.location.origin : ""}/wrap/report/${id}`}
              </p>
              <button onClick={copyLink} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:text-white">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <a
                href={`/wrap/report/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      {!isPaid && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/[0.06] bg-[#0a0a0a]/95 p-4 backdrop-blur space-y-2">
          {receipts.length > 0 && (
            <button
              onClick={handleSendReport}
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3.5 text-sm font-bold text-black transition hover:bg-[#d4a853]/90 disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send to client</>}
            </button>
          )}
          <button
            onClick={() => router.push(`/wrap/upload?trip=${id}`)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
          >
            <Plus className="h-4 w-4" /> Add receipt
          </button>
        </div>
      )}
    </div>
  );
}
