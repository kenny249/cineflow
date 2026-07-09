"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, X, FileText, Check, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createInvoice } from "@/lib/supabase/queries";
import type { Invoice, InvoiceStatus } from "@/types";

// ── CSV parsing (shared logic with the crew importer) ──────────────────────────
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((l) => parseCSVLine(l));
  return { headers, rows };
}

// ── Target fields + auto-detection aliases ─────────────────────────────────────
type Field = "invoice_number" | "client_name" | "client_email" | "description" | "amount" | "status" | "invoice_date" | "paid_date";
const FIELDS: { key: Field; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "client_name",    label: "Client name", required: true, aliases: ["client", "client name", "customer", "customer name", "bill to", "company", "contact", "name"] },
  { key: "amount",         label: "Amount", required: true, aliases: ["amount", "total", "total amount", "amount due", "invoice total", "grand total", "balance", "price"] },
  { key: "invoice_number", label: "Invoice #", aliases: ["invoice number", "invoice #", "invoice no", "number", "invoice id", "doc number", "invoice"] },
  { key: "status",         label: "Status", aliases: ["status", "payment status", "state", "paid"] },
  { key: "invoice_date",   label: "Invoice date", aliases: ["date", "invoice date", "issue date", "created", "created date", "issued"] },
  { key: "paid_date",      label: "Paid date", aliases: ["paid date", "payment date", "date paid", "paid on", "payment received"] },
  { key: "client_email",   label: "Client email", aliases: ["email", "client email", "customer email", "e-mail"] },
  { key: "description",    label: "Description", aliases: ["description", "memo", "notes", "item", "service", "details", "line item", "project"] },
];

function normalizeStatus(raw: string): InvoiceStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return "draft";
  if (/paid|complete|closed|received/.test(s)) return "paid";
  if (/overdue|past.?due|late/.test(s)) return "overdue";
  if (/partial/.test(s)) return "partial";
  if (/sent|open|unpaid|outstanding|due|pending/.test(s)) return "sent";
  return "draft";
}
function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}
function parseDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

interface Props { onClose: () => void; onImported: (count: number) => void }

export function FinanceImportModal({ onClose, onImported }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<Field, number>>({} as Record<Field, number>);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const { headers: h, rows: r } = parseCSV(String(reader.result ?? ""));
      if (h.length === 0) { toast.error("Couldn't read that CSV — is it empty?"); return; }
      setHeaders(h);
      setRows(r);
      // Auto-map each target field to the best-matching column.
      const lower = h.map((x) => x.toLowerCase());
      const auto = {} as Record<Field, number>;
      for (const f of FIELDS) {
        let idx = -1;
        for (const a of f.aliases) { const i = lower.indexOf(a); if (i >= 0) { idx = i; break; } }
        if (idx < 0) idx = lower.findIndex((col) => f.aliases.some((a) => col.includes(a)));
        auto[f.key] = idx;
      }
      setMapping(auto);
    };
    reader.readAsText(file);
  }

  const cell = (row: string[], f: Field) => (mapping[f] >= 0 ? (row[mapping[f]] ?? "").trim() : "");
  const canImport = mapping.client_name >= 0 && mapping.amount >= 0 && rows.length > 0;

  const preview = useMemo(() => rows.slice(0, 5).map((r) => ({
    client: cell(r, "client_name"),
    amount: parseAmount(cell(r, "amount")),
    number: cell(r, "invoice_number"),
    status: normalizeStatus(cell(r, "status")),
    date: parseDate(cell(r, "invoice_date")),
  })), [rows, mapping]);

  async function runImport() {
    if (!canImport) return;
    setImporting(true);
    let ok = 0;
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const client_name = cell(r, "client_name");
        const amount = parseAmount(cell(r, "amount"));
        if (!client_name && amount === 0) { setProgress(i + 1); continue; } // skip blank rows
        const status = mapping.status >= 0 ? normalizeStatus(cell(r, "status")) : "draft";
        const paidDate = parseDate(cell(r, "paid_date")) ?? (status === "paid" ? parseDate(cell(r, "invoice_date")) : null);
        const payload = {
          invoice_number: cell(r, "invoice_number") || `IMP-${Date.now().toString().slice(-6)}-${i + 1}`,
          client_name: client_name || "Imported client",
          client_email: cell(r, "client_email") || undefined,
          description: cell(r, "description") || "Imported invoice",
          amount,
          amount_paid: status === "paid" ? amount : 0,
          status,
          invoice_date: parseDate(cell(r, "invoice_date")) ?? undefined,
          paid_date: paidDate ?? undefined,
          tax_rate: 0,
          line_items: [],
          currency: "USD",
        } as unknown as Omit<Invoice, "id" | "created_at" | "updated_at">;
        try { await createInvoice(payload); ok++; } catch { /* skip bad row */ }
        setProgress(i + 1);
      }
      toast.success(`Imported ${ok} invoice${ok !== 1 ? "s" : ""}`);
      onImported(ok);
    } catch {
      toast.error("Import failed partway — imported what it could");
      onImported(ok);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-sm font-semibold">Import invoices</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">From QuickBooks, HoneyBook, Bonsai, Wave, FreshBooks, or any spreadsheet — export a CSV and drop it here.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {headers.length === 0 ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-12 text-muted-foreground transition-colors hover:border-[#d4a853]/40 hover:text-[#d4a853]"
            >
              <Upload className="h-8 w-8" />
              <span className="text-sm font-medium">Choose a CSV file</span>
              <span className="text-[11px] text-muted-foreground/60">We&apos;ll auto-detect the columns; you can adjust before importing.</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </button>
          ) : (
            <>
              {/* Column mapping */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><FileText className="h-3.5 w-3.5 text-[#d4a853]" /> Map your columns · {rows.length} rows found</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-xs text-muted-foreground">{f.label}{f.required && <span className="text-[#d4a853]"> *</span>}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                      <select
                        value={mapping[f.key] ?? -1}
                        onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                        className="min-w-0 flex-1 rounded-md border border-border bg-input px-2 py-1.5 text-xs text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                      >
                        <option value={-1}>— skip —</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <p className="mb-2 text-xs font-semibold text-foreground">Preview (first {preview.length})</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-2 py-1.5 text-left">Client</th><th className="px-2 py-1.5 text-left">Invoice #</th><th className="px-2 py-1.5 text-right">Amount</th><th className="px-2 py-1.5 text-left">Status</th><th className="px-2 py-1.5 text-left">Date</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {preview.map((p, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 text-foreground truncate max-w-[140px]">{p.client || <span className="text-red-400">—</span>}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{p.number || "auto"}</td>
                          <td className="px-2 py-1.5 text-right font-medium text-[#d4a853] tabular-nums">${p.amount.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-muted-foreground capitalize">{p.status}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{p.date ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {!canImport && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-400"><AlertCircle className="h-3 w-3" /> Map at least Client name and Amount to import.</p>
              )}
              <p className="text-[10px] text-muted-foreground/60">Imported invoices land in the Invoices tab. Paid ones count toward revenue; nothing is emailed to clients.</p>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="ghost" size="sm" onClick={() => { setHeaders([]); setRows([]); }}>Choose different file</Button>
                <Button variant="gold" size="sm" onClick={runImport} disabled={!canImport || importing}>
                  {importing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Importing {progress}/{rows.length}…</> : <><Check className="mr-1.5 h-3.5 w-3.5" /> Import {rows.length} invoices</>}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
