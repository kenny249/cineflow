"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 1600;
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Compression failed")); return; }
          const reader = new FileReader();
          reader.onload = () =>
            resolve({ base64: (reader.result as string).split(",")[1], mimeType: "image/jpeg" });
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

function UploadPageInner() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get("trip");

  // Revoke object URL on unmount
  useEffect(() => {
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image."); return; }
    // Revoke previous URL before creating a new one
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageFile(file);
    setImagePreview(url);
    setParsed(null);
  }, []);

  function handleReset() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setImagePreview(null);
    setImageFile(null);
    setParsed(null);
    setCompressedBlob(null);
  }

  async function handleScan() {
    if (!imageFile) return;
    setScanning(true);
    try {
      const { base64, mimeType } = await compressImage(imageFile);
      // Store the blob now so handleSave can reuse it without re-compressing
      const blob = await fetch(`data:${mimeType};base64,${base64}`).then(r => r.blob());
      setCompressedBlob(blob);
      const res = await fetch("/api/wrap/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
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

      // Upload compressed image — reuse blob from scan step if available
      const uploadBlob: Blob = compressedBlob ?? await compressImage(imageFile).then(
        async ({ base64, mimeType }) => fetch(`data:${mimeType};base64,${base64}`).then(r => r.blob())
      );
      const path = `wrap/${user.id}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("wrap-receipts")
        .upload(path, uploadBlob, { contentType: "image/jpeg" });
      if (uploadErr) throw new Error(uploadErr.message);

      const { data: { publicUrl } } = supabase.storage.from("wrap-receipts").getPublicUrl(path);

      const { error } = await supabase.from("wrap_receipts").insert({
        user_id: user.id,
        trip_id: tripId || null,
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
      setTimeout(() => router.replace(tripId ? `/wrap/trip/${tripId}` : "/wrap/dashboard"), 1200);
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
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
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

export default function WrapUploadPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[#d4a853]" />
      </div>
    }>
      <UploadPageInner />
    </Suspense>
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
