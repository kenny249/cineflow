"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt, Plus, LogOut, Loader2, Trash2, ChevronRight,
  Utensils, Plane, Bed, Camera, Package, DollarSign,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const CATEGORIES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  food:          { label: "Food & Drink",  icon: Utensils, color: "text-orange-400" },
  travel:        { label: "Travel",        icon: Plane,    color: "text-blue-400" },
  accommodation: { label: "Hotel",         icon: Bed,      color: "text-purple-400" },
  equipment:     { label: "Equipment",     icon: Camera,   color: "text-[#d4a853]" },
  other:         { label: "Other",         icon: Package,  color: "text-zinc-400" },
};

interface Receipt {
  id: string;
  vendor: string | null;
  amount: number | null;
  currency: string;
  date: string | null;
  category: string | null;
  description: string | null;
  trip_name: string | null;
  image_url: string | null;
  created_at: string;
}

function formatAmount(amount: number | null, currency = "USD") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WrapDashboard() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/wrap"); return; }
    setUserName(user.email?.split("@")[0] ?? "");

    const { data, error } = await supabase
      .from("wrap_receipts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) toast.error("Couldn't load receipts.");
    else setReceipts(data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    setDeleting(id);
    const { error } = await createClient().from("wrap_receipts").delete().eq("id", id);
    if (error) { toast.error("Delete failed."); setDeleting(null); return; }
    setReceipts((r) => r.filter((x) => x.id !== id));
    setDeleting(null);
  }

  async function handleLogout() {
    await createClient().auth.signOut();
    router.replace("/wrap");
  }

  const total = receipts.reduce((s, r) => s + (r.amount ?? 0), 0);

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
        {/* Welcome + total */}
        <div className="mb-6">
          <p className="text-sm text-zinc-500">Hey {userName} 👋</p>
          <h1 className="mt-0.5 text-2xl font-bold text-white">Expenses</h1>
        </div>

        {/* Total card */}
        <div className="mb-6 rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/8 p-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-[#d4a853]" />
            <span className="text-xs text-zinc-400 uppercase tracking-wider">Total logged</span>
          </div>
          <p className="text-3xl font-bold text-white">{formatAmount(total)}</p>
          <p className="mt-1 text-xs text-zinc-500">{receipts.length} receipt{receipts.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Receipt list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Receipt className="h-7 w-7 text-zinc-600" />
            </div>
            <div>
              <p className="font-semibold text-white">No receipts yet</p>
              <p className="mt-1 text-sm text-zinc-500">Tap + to snap your first receipt.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {receipts.map((r) => {
              const cat = CATEGORIES[r.category ?? "other"] ?? CATEGORIES.other;
              const Icon = cat.icon;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#111] px-4 py-3.5"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5`}>
                    <Icon className={`h-4 w-4 ${cat.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{r.vendor ?? "Unknown vendor"}</p>
                    <p className="text-[11px] text-zinc-500">
                      {cat.label}{r.date ? ` · ${formatDate(r.date)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-white">{formatAmount(r.amount, r.currency)}</p>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      {deleting === r.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push("/wrap/upload")}
        className="fixed bottom-8 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#d4a853] shadow-[0_8px_32px_rgba(212,168,83,0.4)] transition hover:bg-[#d4a853]/90 active:scale-95"
      >
        <Plus className="h-6 w-6 text-black" />
      </button>
    </div>
  );
}
