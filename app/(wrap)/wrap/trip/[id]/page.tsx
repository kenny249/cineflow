"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Plus, Loader2, Trash2, Send, CheckCircle2,
  Copy, Utensils, Plane, Bed, Camera, Package, ExternalLink,
  Pencil, X, Check,
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
const CATEGORIES = [
  { value: "food",          label: "Food & Drink", icon: Utensils },
  { value: "travel",        label: "Travel",        icon: Plane },
  { value: "accommodation", label: "Hotel",         icon: Bed },
  { value: "equipment",     label: "Equipment",     icon: Camera },
  { value: "other",         label: "Other",         icon: Package },
];

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

// ── Bottom sheet wrapper ─────────────────────────────────────────────────────
function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative rounded-t-2xl border-t border-white/10 bg-[#141414] px-4 pb-10 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">{title}</p>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-zinc-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Text field ───────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
      />
    </div>
  );
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Trip edit state
  const [editTripOpen, setEditTripOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingTrip, setSavingTrip] = useState(false);

  // Receipt edit state
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [editVendor, setEditVendor] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingReceipt, setSavingReceipt] = useState(false);

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

  // ── Delete receipt ─────────────────────────────────────────────────────────
  async function handleDelete(receiptId: string) {
    setDeleting(receiptId);
    const { error } = await createClient().from("wrap_receipts").delete().eq("id", receiptId);
    if (error) { toast.error("Delete failed."); setDeleting(null); return; }
    setReceipts((r) => r.filter((x) => x.id !== receiptId));
    setConfirmDelete(null);
    setDeleting(null);
  }

  // ── Send to client ─────────────────────────────────────────────────────────
  async function handleSendReport() {
    if (!trip) return;
    setSending(true);
    try {
      const res = await fetch(`/api/wrap/trips/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error("Send failed");
      setTrip((t) => t && { ...t, status: "sent" });
      const reportUrl = `${window.location.origin}/wrap/report/${id}`;
      await navigator.clipboard.writeText(reportUrl).catch(() => {});
      if (data.emailSent) {
        toast.success(`Email sent to ${trip.client_email} and link copied!`);
      } else {
        toast.success("Report link copied! Share it with your client.");
      }
    } catch {
      toast.error("Couldn't send report — try again.");
    } finally {
      setSending(false);
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/wrap/report/${id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied!"));
  }

  // ── Edit trip ──────────────────────────────────────────────────────────────
  function openEditTrip() {
    if (!trip) return;
    setEditName(trip.name);
    setEditClientName(trip.client_name ?? "");
    setEditClientEmail(trip.client_email ?? "");
    setEditNotes(trip.notes ?? "");
    setEditTripOpen(true);
  }

  async function saveTrip() {
    if (!editName.trim()) return;
    setSavingTrip(true);
    const { error } = await createClient().from("wrap_trips").update({
      name: editName.trim(),
      client_name: editClientName.trim() || null,
      client_email: editClientEmail.trim().toLowerCase() || null,
      notes: editNotes.trim() || null,
    }).eq("id", id);
    setSavingTrip(false);
    if (error) { toast.error("Couldn't save changes."); return; }
    setTrip((t) => t && {
      ...t,
      name: editName.trim(),
      client_name: editClientName.trim() || null,
      client_email: editClientEmail.trim().toLowerCase() || null,
      notes: editNotes.trim() || null,
    });
    setEditTripOpen(false);
    toast.success("Trip updated.");
  }

  // ── Edit receipt ───────────────────────────────────────────────────────────
  function openEditReceipt(r: Receipt) {
    setEditingReceipt(r);
    setEditVendor(r.vendor ?? "");
    setEditAmount(r.amount != null ? String(r.amount) : "");
    setEditDate(r.date ?? "");
    setEditCategory(r.category ?? "other");
    setEditDescription(r.description ?? "");
  }

  async function saveReceipt() {
    if (!editingReceipt) return;
    setSavingReceipt(true);
    const updates = {
      vendor: editVendor.trim() || null,
      amount: editAmount === "" ? null : parseFloat(editAmount.replace(/[^\d.]/g, "")) || null,
      date: editDate.trim() || null,
      category: editCategory || "other",
      description: editDescription.trim() || null,
    };
    const { error } = await createClient().from("wrap_receipts").update(updates).eq("id", editingReceipt.id);
    setSavingReceipt(false);
    if (error) { toast.error("Couldn't save receipt."); return; }
    setReceipts((rs) => rs.map((r) => r.id === editingReceipt.id ? { ...r, ...updates } : r));
    setEditingReceipt(null);
    toast.success("Receipt updated.");
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
        <div className="flex items-center gap-1">
          {isPaid && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Paid
            </span>
          )}
          {!isPaid && (
            <button onClick={openEditTrip} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:text-white">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Trip meta */}
        {(trip.client_name || trip.client_email || trip.notes) && (
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
                const isConfirming = confirmDelete === r.id;

                return (
                  <div key={r.id} className="rounded-xl border border-white/[0.06] bg-[#111]">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{r.vendor ?? "Unknown"}</p>
                        {r.date && <p className="text-[11px] text-zinc-500">{formatDate(r.date)}</p>}
                      </div>
                      <p className="text-sm font-semibold text-white shrink-0">{formatAmount(r.amount, r.currency)}</p>
                      {!isPaid && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setConfirmDelete(null); openEditReceipt(r); }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-white/10 hover:text-zinc-300"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(isConfirming ? null : r.id)}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition
                              ${isConfirming ? "bg-red-500/20 text-red-400" : "text-zinc-600 hover:bg-red-500/10 hover:text-red-400"}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Inline delete confirmation */}
                    {isConfirming && (
                      <div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-2.5">
                        <p className="flex-1 text-xs text-zinc-400">Delete this receipt?</p>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deleting === r.id}
                          className="flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/25"
                        >
                          {deleting === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3" /> Delete</>}
                        </button>
                      </div>
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
                {`${window.location.origin}/wrap/report/${id}`}
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
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Send className="h-4 w-4" /> {isSent ? "Resend to client" : "Send to client"}</>
              }
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

      {/* Edit trip sheet */}
      <Sheet open={editTripOpen} onClose={() => setEditTripOpen(false)} title="Edit trip">
        <div className="space-y-3">
          <Field label="Trip name *" value={editName} onChange={setEditName} placeholder="LA Client Shoot" />
          <Field label="Client name" value={editClientName} onChange={setEditClientName} placeholder="ACME Productions" />
          <Field label="Client email" value={editClientEmail} onChange={setEditClientEmail} placeholder="client@studio.com" type="email" />
          <div>
            <p className="mb-1 text-xs text-zinc-500">Notes</p>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              placeholder="Any notes for the client…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
            />
          </div>
          <button
            onClick={saveTrip}
            disabled={!editName.trim() || savingTrip}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3 text-sm font-bold text-black transition hover:bg-[#d4a853]/90 disabled:opacity-50"
          >
            {savingTrip ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Save changes</>}
          </button>
        </div>
      </Sheet>

      {/* Edit receipt sheet */}
      <Sheet
        open={!!editingReceipt}
        onClose={() => setEditingReceipt(null)}
        title="Edit receipt"
      >
        <div className="space-y-3">
          <Field label="Vendor" value={editVendor} onChange={setEditVendor} placeholder="Business name" />
          <div>
            <p className="mb-1 text-xs text-zinc-500">Amount (USD)</p>
            <input
              type="text"
              inputMode="decimal"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0.00"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
            />
          </div>
          <Field label="Date (YYYY-MM-DD)" value={editDate} onChange={setEditDate} placeholder="2026-06-01" />
          <Field label="Description" value={editDescription} onChange={setEditDescription} placeholder="What was purchased" />
          <div>
            <p className="mb-2 text-xs text-zinc-500">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setEditCategory(c.value)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition
                    ${editCategory === c.value
                      ? "border-[#d4a853]/50 bg-[#d4a853]/15 text-[#d4a853]"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"
                    }`}
                >
                  <c.icon className="h-3 w-3" />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={saveReceipt}
            disabled={savingReceipt}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3 text-sm font-bold text-black transition hover:bg-[#d4a853]/90 disabled:opacity-50"
          >
            {savingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Save receipt</>}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
