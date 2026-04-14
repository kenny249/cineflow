"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Film, Loader2, AlertCircle, Printer, CheckCircle2, Shield } from "lucide-react";

interface CertData {
  contract: {
    id: string;
    title: string;
    description?: string;
    status: string;
    recipient_name?: string;
    recipient_email?: string;
    signed_at?: string;
  };
  signature: {
    signer_name: string;
    signer_email?: string;
    signature_data: string;
    signed_at: string;
    ip_address?: string;
  } | null;
}

export default function CertificatePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/contracts/certificate?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("Failed to load certificate"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f4f5]">
        <Loader2 className="h-6 w-6 animate-spin text-[#a1a1aa]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f4f5] p-6 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-[#71717a]">{error ?? "Certificate not found"}</p>
      </div>
    );
  }

  const { contract, signature } = data;
  const signedDate = signature?.signed_at
    ? new Date(signature.signed_at).toLocaleString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#f4f4f5] py-10 px-4 print:bg-white print:p-0">
      {/* Print button — hidden when printing */}
      <div className="mx-auto mb-6 flex max-w-2xl items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#18181b]">
            <Film className="h-3.5 w-3.5 text-[#d4a853]" />
          </div>
          <span className="text-sm font-semibold text-[#18181b]">Cineflow</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-[#18181b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#27272a] transition-colors"
        >
          <Printer className="h-4 w-4" />
          Save / Print
        </button>
      </div>

      {/* Certificate card */}
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-sm print:rounded-none print:shadow-none print:border-0">

        {/* Header */}
        <div className="bg-[#18181b] px-8 py-6 print:px-6 print:py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#d4a853]/70">Electronic Signature Certificate</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{contract.title}</h1>
              {contract.description && (
                <p className="mt-1 text-sm text-[#a1a1aa]">{contract.description}</p>
              )}
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#f4f4f5] px-8 py-0 print:px-6">

          {/* Status banner */}
          <div className="py-5">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 border border-emerald-100">
              <Shield className="h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">
                This document has been signed electronically and is legally binding.
              </p>
            </div>
          </div>

          {/* Parties */}
          <div className="py-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#a1a1aa]">Parties</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa] mb-1">Sender</p>
                <p className="text-sm font-semibold text-[#18181b]">Cineflow Studio</p>
              </div>
              <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa] mb-1">Signer</p>
                <p className="text-sm font-semibold text-[#18181b]">{signature?.signer_name ?? contract.recipient_name ?? "—"}</p>
                {(signature?.signer_email ?? contract.recipient_email) && (
                  <p className="text-xs text-[#71717a] mt-0.5">{signature?.signer_email ?? contract.recipient_email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Signature */}
          {signature?.signature_data && (
            <div className="py-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#a1a1aa]">Signature</p>
              <div className="rounded-xl border-2 border-[#e4e4e7] bg-white p-4">
                <img
                  src={signature.signature_data}
                  alt="Signature"
                  className="max-h-24 max-w-xs object-contain"
                />
                <p className="mt-2 text-xs text-[#a1a1aa]">{signature.signer_name}</p>
              </div>
            </div>
          )}

          {/* Signing details */}
          <div className="py-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#a1a1aa]">Signing Details</p>
            <div className="space-y-2">
              {signedDate && (
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs text-[#71717a]">Date &amp; Time</p>
                  <p className="text-xs font-medium text-right text-[#18181b]">{signedDate}</p>
                </div>
              )}
              {signature?.ip_address && (
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs text-[#71717a]">IP Address</p>
                  <p className="text-xs font-mono text-[#18181b]">{signature.ip_address}</p>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs text-[#71717a]">Document ID</p>
                <p className="text-xs font-mono text-[#18181b] break-all text-right">{contract.id}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="py-4">
            <p className="text-center text-[11px] text-[#a1a1aa]">
              This certificate was generated by <strong>Cineflow</strong> · usecineflow.com
              <br />
              Electronic signatures executed on this platform are legally valid under ESIGN &amp; UETA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
