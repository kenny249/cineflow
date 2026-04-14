"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Film, Pen, RotateCcw, CheckCircle2, AlertCircle,
  Loader2, FileText, ChevronRight, Download, ExternalLink,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { SignatureField } from "@/types";

const PDFViewer = dynamic(
  () => import("@/components/contracts/PDFViewer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center bg-[#fafafa]">
        <Loader2 className="h-5 w-5 animate-spin text-[#a1a1aa]" />
      </div>
    ),
  }
);

interface ContractData {
  id: string;
  title: string;
  description?: string;
  file_url?: string;
  status: string;
  recipient_name?: string;
  recipient_email?: string;
  recipient_role?: string;
  signed_at?: string;
  signature_fields?: SignatureField[];
  sender_signed_at?: string;
  signed_pdf_url?: string;
}

type Step = "review" | "sign" | "done";

const ROLE_LABEL: Record<string, string> = {
  client: "Client Agreement",
  crew: "Crew Agreement",
  talent: "Talent Release",
  location: "Location Release",
  vendor: "Vendor Agreement",
  other: "Agreement",
};

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("review");

  // Form
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [sigMode, setSigMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");

  // Live signature preview passed into PDFViewer
  const [sigPreview, setSigPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/contracts/sign?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setContract(d.contract);
        if (d.contract.recipient_name) {
          setSignerName(d.contract.recipient_name);
          setTypedName(d.contract.recipient_name);
        }
        if (d.contract.recipient_email) setSignerEmail(d.contract.recipient_email);
        if (d.contract.status === "signed") setStep("done");
      })
      .catch(() => setError("Failed to load contract"))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Canvas helpers ────────────────────────────────────────────────────────

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
    setSigPreview(canvas.toDataURL("image/png"));
  }

  function stopDraw() {
    setDrawing(false);
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSigPreview(null);
    setTypedName("");
  }

  function renderTypedSig(name: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!name.trim()) { setHasSignature(false); setSigPreview(null); return; }
    ctx.font = "italic 52px Palatino Linotype, Palatino, Book Antiqua, Georgia, serif";
    ctx.fillStyle = "#18181b";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(name).width;
    const x = Math.max(16, (canvas.width - tw) / 2);
    const y = canvas.height / 2;
    ctx.fillText(name, x, y);
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 28);
    ctx.lineTo(x + tw + 8, y + 28);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 1;
    ctx.stroke();
    setHasSignature(true);
    setSigPreview(canvas.toDataURL("image/png"));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!hasSignature || !signerName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const signatureData = canvasRef.current!.toDataURL("image/png");
      const res = await fetch(`/api/contracts/sign?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          signer_email: signerEmail.trim() || undefined,
          signature_data: signatureData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setStep("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit signature");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Fields with live preview injected ───────────────────────────────────

  const fieldsWithPreview: (SignatureField & { signatureData?: string })[] =
    (contract?.signature_fields ?? []).map((f) =>
      f.role === "recipient" && sigPreview ? { ...f, signatureData: sigPreview } : f
    );

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f4f5]">
        <Loader2 className="h-6 w-6 animate-spin text-[#a1a1aa]" />
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f4f5] p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-[#18181b]">Link not found</h1>
        <p className="text-sm text-[#71717a]">{error}</p>
      </div>
    );
  }

  // ── Done step ─────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f4f4f5] p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#18181b]">Signed</h1>
          <p className="mt-1 max-w-sm text-sm text-[#71717a]">
            Your signature has been recorded. The contract is fully executed.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          {contract?.signed_pdf_url && (
            <a
              href={contract.signed_pdf_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Signed Contract
            </a>
          )}
          <a
            href={`/sign/${token}/certificate`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#18181b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#27272a] transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View Certificate
          </a>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-[#a1a1aa]">
          <Film className="h-3.5 w-3.5" />
          Powered by Cineflow
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABEL[contract?.recipient_role ?? "client"] ?? "Agreement";
  const recipientFields = (contract?.signature_fields ?? []).filter((f) => f.role === "recipient");

  // ── Review step ───────────────────────────────────────────────────────────

  if (step === "review") {
    return (
      <div className="min-h-screen bg-[#f4f4f5]">
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-[#e4e4e7] bg-white px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18181b]">
                <Film className="h-3.5 w-3.5 text-[#d4a853]" />
              </div>
              <span className="text-sm font-semibold text-[#18181b]">Cineflow</span>
            </div>
            {/* Step progress */}
            <div className="flex items-center gap-1.5 text-xs text-[#71717a]">
              <span className="font-semibold text-[#18181b]">1. Review</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>2. Sign</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>3. Done</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-32">
          {/* Contract info card */}
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-[#e4e4e7]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#18181b]">
                <FileText className="h-5 w-5 text-[#d4a853]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a1a1aa]">{roleLabel}</p>
                <h1 className="mt-0.5 truncate text-lg font-bold text-[#18181b]">{contract?.title}</h1>
                {contract?.description && (
                  <p className="mt-0.5 text-sm text-[#71717a]">{contract.description}</p>
                )}
                {contract?.recipient_name && (
                  <p className="mt-1 text-xs text-[#71717a]">For: <span className="font-medium text-[#18181b]">{contract.recipient_name}</span></p>
                )}
              </div>
            </div>
          </div>

          {/* PDF viewer */}
          {contract?.file_url ? (
            <div className="overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-sm">
              {recipientFields.length > 0 && (
                <div className="flex items-center gap-2 border-b border-[#e4e4e7] bg-[#fffbf2] px-4 py-2.5">
                  <div className="h-2 w-2 rounded-full bg-[#d4a853] animate-pulse" />
                  <p className="text-xs font-medium text-[#92680a]">
                    {recipientFields.length} signature field{recipientFields.length !== 1 ? "s" : ""} need{recipientFields.length === 1 ? "s" : ""} your signature — click any highlighted box or tap Sign below
                  </p>
                </div>
              )}
              <PDFViewer
                url={contract.file_url}
                fields={fieldsWithPreview}
                highlightRole="recipient"
                onFieldClick={(field) => { if ((field.type ?? "signature") === "signature") setStep("sign"); }}
                className="h-[520px]"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#e4e4e7] bg-white py-12 text-center">
              <FileText className="h-8 w-8 text-[#d4d4d8]" />
              <p className="text-sm text-[#a1a1aa]">No document attached</p>
            </div>
          )}
        </div>

        {/* Sticky footer CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#e4e4e7] bg-white px-4 py-4 shadow-lg">
          <div className="mx-auto flex max-w-2xl items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-[#18181b]">{contract?.title}</p>
              <p className="text-xs text-[#71717a]">
                {recipientFields.length > 0
                  ? "Review the document above, then sign"
                  : "Read the document, then sign below"}
              </p>
            </div>
            <button
              onClick={() => setStep("sign")}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-[#d4a853] px-6 py-3 text-sm font-bold text-black hover:bg-[#c49840] transition-colors"
            >
              <Pen className="h-4 w-4" />
              Sign →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Sign step ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f4f4f5]">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-[#e4e4e7] bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18181b]">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <span className="text-sm font-semibold text-[#18181b]">Cineflow</span>
          </div>
          {/* Step progress */}
          <div className="flex items-center gap-1.5 text-xs text-[#71717a]">
            <button onClick={() => setStep("review")} className="hover:text-[#18181b] transition-colors">1. Review</button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-semibold text-[#18181b]">2. Sign</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>3. Done</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {/* Contract name reminder */}
        <div className="flex items-center gap-2 rounded-xl border border-[#e4e4e7] bg-white px-4 py-3">
          <FileText className="h-4 w-4 shrink-0 text-[#d4a853]" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#18181b]">{contract?.title}</p>
            <p className="text-xs text-[#a1a1aa]">{roleLabel}</p>
          </div>
          <button
            onClick={() => setStep("review")}
            className="ml-auto shrink-0 text-xs text-[#71717a] hover:text-[#18181b] underline"
          >
            Re-read
          </button>
        </div>

        {/* Signature form */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-[#e4e4e7] space-y-4">
          <div className="flex items-center gap-2">
            <Pen className="h-4 w-4 text-[#d4a853]" />
            <h2 className="font-semibold text-[#18181b]">Your Signature</h2>
          </div>

          {/* Name + email */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#3f3f46]">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                value={signerName}
                onChange={(e) => {
                  setSignerName(e.target.value);
                  if (sigMode === "type") {
                    setTypedName(e.target.value);
                    renderTypedSig(e.target.value);
                  }
                }}
                placeholder="Your full legal name"
                className="w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] placeholder:text-[#a1a1aa] focus:border-[#d4a853] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#3f3f46]">
                Email <span className="text-[#a1a1aa] font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] placeholder:text-[#a1a1aa] focus:border-[#d4a853] focus:outline-none"
              />
            </div>
          </div>

          {/* Draw / Type toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5 rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] p-0.5">
                <button
                  type="button"
                  onClick={() => { setSigMode("draw"); clearCanvas(); }}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${sigMode === "draw" ? "bg-white text-[#18181b] shadow-sm" : "text-[#71717a] hover:text-[#18181b]"}`}
                >
                  <Pen className="h-3 w-3" /> Draw
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSigMode("type");
                    setTypedName(signerName);
                    renderTypedSig(signerName);
                  }}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${sigMode === "type" ? "bg-white text-[#18181b] shadow-sm" : "text-[#71717a] hover:text-[#18181b]"}`}
                >
                  <span className="font-serif italic text-sm leading-none">T</span> Type
                </button>
              </div>
              {hasSignature && (
                <button
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-xs text-[#71717a] hover:text-[#18181b]"
                >
                  <RotateCcw className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            {sigMode === "type" ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => {
                    setTypedName(e.target.value);
                    renderTypedSig(e.target.value);
                  }}
                  placeholder="Type your name to sign…"
                  className="w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] placeholder:text-[#a1a1aa] focus:border-[#d4a853] focus:outline-none"
                  autoFocus
                />
                <div className={`relative overflow-hidden rounded-xl border-2 ${hasSignature ? "border-[#d4a853]" : "border-[#e4e4e7]"} bg-white`}>
                  <canvas ref={canvasRef} width={600} height={160} className="w-full" />
                  {!hasSignature && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <p className="font-serif italic text-lg text-[#d4d4d8]">Your signature will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`relative overflow-hidden rounded-xl border-2 transition-colors ${drawing ? "border-[#d4a853]" : "border-[#e4e4e7]"} bg-white`}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={160}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
                {!hasSignature && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-[#d4d4d8]">Draw your signature here</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live PDF preview with signature placed */}
          {contract?.file_url && hasSignature && recipientFields.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#71717a]">Preview — your signature in the document</p>
              <div className="overflow-hidden rounded-xl border border-[#e4e4e7]">
                <PDFViewer
                  url={contract.file_url}
                  fields={fieldsWithPreview}
                  highlightRole="recipient"
                  className="h-[280px]"
                />
              </div>
            </div>
          )}

          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</p>
          )}

          <p className="text-[11px] text-[#a1a1aa]">
            By signing, you confirm that this electronic signature is the legal equivalent of your handwritten signature and is binding.
          </p>

          <button
            onClick={handleSubmit}
            disabled={submitting || !hasSignature || !signerName.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3.5 text-sm font-bold text-black hover:bg-[#c49840] disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Submit Signature</>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-[#a1a1aa] pb-6">
          Powered by <strong>Cineflow</strong> · Secure electronic signing
        </p>
      </div>
    </div>
  );
}
