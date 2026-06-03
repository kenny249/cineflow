"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Folder } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function NewTripPage() {
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/wrap"); return; }

    const { data, error } = await supabase
      .from("wrap_trips")
      .insert({
        user_id: user.id,
        name: name.trim(),
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim().toLowerCase() || null,
        notes: notes.trim() || null,
        status: "open",
      })
      .select("id")
      .single();

    setSaving(false);
    if (error) { toast.error("Couldn't create trip."); return; }
    router.replace(`/wrap/trip/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-10">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-white">New Trip</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 pt-6 space-y-4">
        <div className="flex flex-col items-center gap-3 pb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Folder className="h-7 w-7 text-[#d4a853]" />
          </div>
          <p className="text-sm text-zinc-400">Group your receipts into a trip to bill a client.</p>
        </div>

        <Field label="Trip name *" placeholder="LA Client Shoot — June 2026" value={name} onChange={setName} />
        <Field label="Client name" placeholder="ACME Productions" value={clientName} onChange={setClientName} />
        <Field label="Client email" placeholder="client@studio.com" type="email" value={clientEmail} onChange={setClientEmail} />

        <div>
          <p className="mb-1.5 text-xs text-zinc-500">Notes (optional)</p>
          <textarea
            placeholder="Any notes for the client…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
          />
        </div>

        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3.5 text-sm font-bold text-black transition hover:bg-[#d4a853]/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create trip"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, type = "text" }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-zinc-500">{label}</p>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
      />
    </div>
  );
}
