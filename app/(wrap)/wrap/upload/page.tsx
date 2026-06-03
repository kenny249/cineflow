"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, Upload, Loader2, CheckCircle2, ArrowLeft,
  Receipt, Utensils, Plane, Bed, Package, RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "food",          label: "Food & Drink",  icon: Utensils },
  { value: "travel",        label: "Travel",         icon: Plane },
  { value: "accommodation", label: "Hotel",          icon: Bed },
  { value: "equipment",     label: "Equipment",      icon: Camera },
  { value: "other",         label: "Other",          icon: Package },
];

interface ParsedReceipt {
  vendor: string;
  amount: number | null;
  date: string;
  category: string;
  description: string;
}

export default function WrapUploadPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image."); return; }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setParsed(null);
  }, []);

  async function handleScan() {
    if (!imageFile) return;
    setScanning(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const res = await fetch("/api/wrap/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType: imageFile.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setParsed(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Scan failed — try again.");
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    if (!parsed || !imageFile) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/wrap"); return; }

      // Upload image
      const ext = imageFile.name.split(".").pop() ?? "jpg";
      const path = `wrap/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("wrap-receipts")
        .upload(path, imageFile, { contentType: imageFile.type });
      if (uploadErr) throw new Error(uploadErr.message);

      const { data: { publicUrl } } = supabase.storage.from("wrap-receipts").getPublicUrl(path);

      // Save receipt
      const { error } = await supabase.from("wrap_receipts").insert({
        user_id: user.id,
        vendor: parsed.vendor || null,
        amount: parsed.amount,
        currency: "USD",
        date: parsed.date || null,
        category: parsed.category || "other",
        description: parsed.description || null,
        image_url: publicUrl,
      });
      if (error) throw new Error(error.message);

      setDone(true);
      setTimeout(() => router.replace("/wrap/dashboard"), 1200);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <p className="font-semibold text-white">Receipt saved!</p>
        <p className="text-sm text-zinc-500">Heading back to your expenses…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-white">Add Receipt</p>
      </div>

      <div className="px-4 pt-6 space-y-5">
        {/* Image picker */}
        <div
          onClick={() => !imagePreview && fileRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition
            ${imagePreview
              ? "border-white/10 bg-[#111]"
              : "cursor-pointer border-white/10 bg-white/[0.02] hover:border-[#d4a853]/40 hover:bg-[#d4a853]/[0.02]"
            }`}
          style={{ minHeight: 220 }}
        >
          {imagePreview ? (
            <>
              <img
                src={imagePreview}
                alt="Receipt"
                className="max-h-64 w-full rounded-2xl object-contain"
              />
              <button
                onClick={(e) => { e.stopPropagation(); setImagePreview(null); setImageFile(null); setParsed(null); }}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center px-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Receipt className="h-7 w-7 text-zinc-600" />
              </div>
              <div>
                <p className="font-medium text-white">Snap or upload a receipt</p>
                <p className="mt-1 text-xs text-zinc-500">Tap to choose from camera or gallery</p>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.setAttribute("capture", "environment"); fileRef.current?.click(); }}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/10"
                >
                  <Camera className="h-3.5 w-3.5" /> Camera
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.removeAttribute("capture"); fileRef.current?.click(); }}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/10"
                >
                  <Upload className="h-3.5 w-3.5" /> Gallery
                </button>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {/* Scan button */}
        {imageFile && !parsed && (
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3.5 text-sm font-bold text-black transition hover:bg-[#d4a853]/90 disabled:opacity-60"
          >
            {scanning ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Reading receipt…</>
            ) : (
              "Scan with AI"
            )}
          </button>
        )}

        {/* Parsed form */}
        {parsed && (
          <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-[#111] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Review & edit</p>

            <div className="space-y-3">
              <Field
                label="Vendor"
                value={parsed.vendor}
                onChange={(v) => setParsed((p) => p && { ...p, vendor: v })}
              />
              <Field
                label="Amount (USD)"
                value={parsed.amount != null ? String(parsed.amount) : ""}
                inputMode="decimal"
                onChange={(v) => setParsed((p) => p && { ...p, amount: v === "" ? null : parseFloat(v.replace(/[^\d.]/g, "")) || null })}
              />
              <Field
                label="Date"
                value={parsed.date}
                onChange={(v) => setParsed((p) => p && { ...p, date: v })}
              />
              <Field
                label="Description"
                value={parsed.description}
                onChange={(v) => setParsed((p) => p && { ...p, description: v })}
              />

              {/* Category picker */}
              <div>
                <p className="mb-2 text-xs text-zinc-500">Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setParsed((p) => p && { ...p, category: c.value })}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition
                        ${parsed.category === c.value
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
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3.5 text-sm font-bold text-black transition hover:bg-[#d4a853]/90 disabled:opacity-60"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save receipt"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
      />
    </div>
  );
}
