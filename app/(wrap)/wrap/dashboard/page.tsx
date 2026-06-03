"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt, Plus, LogOut, Loader2, ChevronRight,
  Folder, DollarSign, CheckCircle2, Send, Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Trip {
  id: string;
  name: string;
  client_name: string | null;
  status: "open" | "sent" | "paid";
  created_at: string;
  receipt_count: number;
  total: number;
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

const STATUS_META = {
  open:  { label: "Open",   icon: Clock,         color: "text-zinc-400",   bg: "bg-zinc-500/10" },
  sent:  { label: "Sent",   icon: Send,           color: "text-blue-400",   bg: "bg-blue-500/10" },
  paid:  { label: "Paid",   icon: CheckCircle2,   color: "text-emerald-400", bg: "bg-emerald-500/10" },
};

export default function WrapDashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const router = useRouter();

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/wrap"); return; }
    setUserName(user.email?.split("@")[0] ?? "");

    const { data, error } = await supabase
      .from("wrap_trips")
      .select("*, wrap_receipts(amount)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) { toast.error("Couldn't load trips."); setLoading(false); return; }

    const enriched: Trip[] = (data ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      client_name: t.client_name,
      status: t.status,
      created_at: t.created_at,
      receipt_count: t.wrap_receipts?.length ?? 0,
      total: (t.wrap_receipts ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0),
    }));

    setTrips(enriched);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await createClient().auth.signOut();
    router.replace("/wrap");
  }

  const totalAll = trips.reduce((s, t) => s + t.total, 0);
  const totalPaid = trips.filter(t => t.status === "paid").reduce((s, t) => s + t.total, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0a0a]/95 px-4 py-3.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Receipt className="h-3.5 w-3.5 text-[#d4a853]" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.3em] text-[#d4a853] uppercase">Wrap</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-4 pt-6">
        <div className="mb-6">
          <p className="text-sm text-zinc-500">Hey {userName} 👋</p>
          <h1 className="mt-0.5 text-2xl font-bold text-white">Trips</h1>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/8 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-[#d4a853]" />
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Total billed</span>
            </div>
            <p className="text-xl font-bold text-white">{formatAmount(totalAll)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Collected</span>
            </div>
            <p className="text-xl font-bold text-white">{formatAmount(totalPaid)}</p>
          </div>
        </div>

        {/* Trip list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Folder className="h-7 w-7 text-zinc-600" />
            </div>
            <div>
              <p className="font-semibold text-white">No trips yet</p>
              <p className="mt-1 text-sm text-zinc-500">Create a trip to start logging expenses.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {trips.map((trip) => {
              const meta = STATUS_META[trip.status];
              const Icon = meta.icon;
              return (
                <button
                  key={trip.id}
                  onClick={() => router.push(`/wrap/trip/${trip.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-[#111] px-4 py-3.5 text-left transition hover:border-[#d4a853]/20"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
                    <Folder className="h-5 w-5 text-[#d4a853]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{trip.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {trip.client_name ?? "No client"} · {trip.receipt_count} receipt{trip.receipt_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-bold text-white">{formatAmount(trip.total)}</p>
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.color}`}>
                      <Icon className="h-2.5 w-2.5" />
                      {meta.label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push("/wrap/trip/new")}
        className="fixed bottom-8 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#d4a853] shadow-[0_8px_32px_rgba(212,168,83,0.4)] transition hover:bg-[#d4a853]/90 active:scale-95"
      >
        <Plus className="h-6 w-6 text-black" />
      </button>
    </div>
  );
}
