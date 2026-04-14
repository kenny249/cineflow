"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Film, Pen, RotateCcw, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import dynamic from "next/dynamic";
import type { SignatureField } from "@/types";
// Load PDFViewer client-only — pdfjs-dist uses Node canvas which breaks SSR
const PDFViewer = dynamic(
  () => import("@/components/contracts/PDFViewer").then((m) => m.PDFViewer),
  { ssr: false, loading: () => <div className="flex h-[520px] items-center justify-center rounded-xl border border-[#e4e4e7] bg-[#fafafa]"><Loader2 className="h-5 w-5 animate-spin text-[#a1a1aa]" /></div> }
);

interface ContractData {
  id: string;
  title: string;
  description?: string;
  file_url?: string;
  status: string;
  recipient_name?: string;
  recipient_email?: string;
  signed_at?: string;
  signature_fields?: SignatureField[];
  sender_signed_at?: string;
  signed_pdf_url?: string;
}

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  // Form
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/contracts/sign?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setContract(d.contract);
        if (d.contract.recipient_name) setSignerName(d.contract.recipient_name);
        if (d.contract.recipient_email) setSignerEmail(d.contract.recipient_email);
        if (d.contract.status === "signed") setSigned(true);
      })
      .catch(() => setError("Failed to load contract"))
      .finally(() => setLoading(false));
  }, [token]);

  // Canvas helpers
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
  }

  function stopDraw() {
    setDrawing(false);
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handleSubmit() {
    if (!hasSignature || !signerName.trim()) return;
    setSubmitting(true);
    try {
      const canvas = canvasRef.current!;
      const signatureData = canvas.toDataURL("image/png");

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
      setSigned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit signature");
    } finally {
      setSubmitting(false);
    }
  }

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

  if (signed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f4f5] p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-[#18181b]">Contract Signed</h1>
        <p className="max-w-sm text-sm text-[#71717a]">
          Your signature has been recorded and the contract is now fully executed.
        </p>
        <div className="mt-2 flex flex-col items-center gap-2">
          {contract?.signed_pdf_url && (
            <a
              href={contract.signed_pdf_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              Download Signed Contract
            </a>
          )}
          <a
            href={`/sign/${token}/certificate`}
            className="flex items-center gap-2 rounded-xl bg-[#18181b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#27272a] transition-colors"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            View Signed Certificate
          </a>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-[#a1a1aa]">
          <Film className="h-3.5 w-3.5" />
          Powered by Cineflow
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5] py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18181b]">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <span className="text-sm font-semibold text-[#18181b]">Cineflow</span>
          </div>
          <span className="text-xs text-[#a1a1aa]">Electronic Signature</span>
        </div>

        {/* Contract info */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-[#e4e4e7]">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#18181b]">
              <FileText className="h-5 w-5 text-[#d4a853]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#a1a1aa]">Contract</p>
              <h1 className="mt-0.5 text-xl font-bold text-[#18181b]">{contract?.title}</h1>
              {contract?.description && (
                <p className="mt-1 text-sm text-[#71717a]">{contract.description}</p>
              )}
            </div>
          </div>

          {/* PDF viewer with signature fields */}
          {contract?.file_url && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#a1a1aa]">Document</p>
              <div className="overflow-hidden rounded-xl border border-[#e4e4e7]">
                <PDFViewer
                  url={contract.file_url}
                  fields={contract.signature_fields ?? []}
                  highlightRole="recipient"
                  onFieldClick={() => {
                    // Scroll down to signature canvas
                    document.getElementById("sign-canvas-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="h-[520px]"
                />
              </div>
              {(contract.signature_fields ?? []).some((f) => f.role === "recipient") && (
                <p className="mt-2 text-xs text-[#71717a]">
                  ↑ Your signature field is highlighted — click it or scroll down to sign
                </p>
              )}
            </div>
          )}
        </div>

        {/* Signature form */}
        <div id="sign-canvas-section" className="rounded-2xl bg-white p-6 shadow-sm border border-[#e4e4e7]">
          <div className="mb-5 flex items-center gap-2">
            <Pen className="h-4 w-4 text-[#d4a853]" />
            <h2 className="font-semibold text-[#18181b]">Sign Below</h2>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[#18181b]">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Your full legal name"
                  className="border-[#e4e4e7] bg-white text-[#18181b] placeholder:text-[#a1a1aa]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#18181b]">Email <span className="text-[#a1a1aa] font-normal">(optional)</span></Label>
                <Input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="border-[#e4e4e7] bg-white text-[#18181b] placeholder:text-[#a1a1aa]"
                />
              </div>
            </div>

            {/* Signature canvas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[#18181b]">Signature <span className="text-red-500">*</span></Label>
                {hasSignature && (
                  <button
                    onClick={clearCanvas}
                    className="flex items-center gap-1 text-xs text-[#71717a] hover:text-[#18181b]"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
              <div className={`relative overflow-hidden rounded-xl border-2 transition-colors ${drawing ? "border-[#d4a853]" : "border-[#e4e4e7]"} bg-white`}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={180}
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
              <p className="text-[11px] text-[#a1a1aa]">
                By signing, you agree that this electronic signature is legally binding.
              </p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || !hasSignature || !signerName.trim()}
              className="w-full bg-[#d4a853] font-semibold text-black hover:bg-[#c49840] disabled:opacity-50"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing…</>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Sign Contract
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-[#a1a1aa]">
          Powered by <strong>Cineflow</strong> · Secure electronic signing
        </p>
      </div>
    </div>
  );
}
