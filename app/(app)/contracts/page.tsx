"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, FileSignature, Send, Trash2, CheckCircle2, Clock,
  FileText, Upload, Link2, Copy, ExternalLink, X, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getProjects } from "@/lib/supabase/queries";
import type { Contract, ContractStatus, Project } from "@/types";

const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string; bg: string }> = {
  draft:    { label: "Draft",    color: "text-muted-foreground",  bg: "bg-muted/60" },
  sent:     { label: "Sent",     color: "text-amber-400",          bg: "bg-amber-400/10 border-amber-400/30" },
  signed:   { label: "Signed",   color: "text-emerald-400",        bg: "bg-emerald-400/10 border-emerald-400/30" },
  declined: { label: "Declined", color: "text-red-400",            bg: "bg-red-400/10 border-red-400/30" },
  voided:   { label: "Voided",   color: "text-muted-foreground/50", bg: "bg-muted/30" },
};

function StatusBadge({ status }: { status: ContractStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export default function ContractsPage() {
  const supabase = createClient();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contract | null>(null);

  // New contract dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fProject, setFProject] = useState("");
  const [fRecipientName, setFRecipientName] = useState("");
  const [fRecipientEmail, setFRecipientEmail] = useState("");
  const [fFile, setFFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Send state
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [projs, res] = await Promise.all([
          getProjects(),
          fetch("/api/contracts"),
        ]);
        setProjects(projs || []);
        const data = await res.json();
        if (data.contracts) {
          setContracts(data.contracts);
          if (data.contracts.length) setSelected(data.contracts[0]);
        }
      } catch {
        toast.error("Failed to load contracts");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function openNew() {
    setFTitle(""); setFDescription(""); setFProject("");
    setFRecipientName(""); setFRecipientEmail(""); setFFile(null);
    setDialogOpen(true);
  }

  const handleCreate = useCallback(async () => {
    if (!fTitle.trim()) return;
    setCreating(true);
    try {
      let fileUrl: string | undefined;

      // Upload PDF if provided
      if (fFile) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const ext = fFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("contracts")
          .upload(path, fFile, { upsert: false });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from("contracts").getPublicUrl(path);
        fileUrl = publicUrl;
      }

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fTitle.trim(),
          description: fDescription.trim() || undefined,
          project_id: fProject || undefined,
          recipient_name: fRecipientName.trim() || undefined,
          recipient_email: fRecipientEmail.trim() || undefined,
          file_url: fileUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setContracts((prev) => [data.contract, ...prev]);
      setSelected(data.contract);
      setDialogOpen(false);
      toast.success("Contract created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create contract");
    } finally {
      setCreating(false);
    }
  }, [fTitle, fDescription, fProject, fRecipientName, fRecipientEmail, fFile]);

  const handleSend = useCallback(async () => {
    if (!selected) return;
    setSending(true);
    try {
      const res = await fetch("/api/contracts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...selected, status: "sent" as ContractStatus, sent_at: new Date().toISOString() };
      setContracts((prev) => prev.map((c) => c.id === selected.id ? updated : c));
      setSelected(updated);
      toast.success(`Contract sent to ${selected.recipient_email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send contract");
    } finally {
      setSending(false);
    }
  }, [selected]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/contracts?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setContracts((prev) => prev.filter((c) => c.id !== id));
      if (selected?.id === id) {
        const remaining = contracts.filter((c) => c.id !== id);
        setSelected(remaining[0] ?? null);
      }
      toast.success("Contract deleted");
    } catch {
      toast.error("Failed to delete contract");
    }
  }, [selected, contracts]);

  const signingUrl = selected?.signing_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/sign/${selected.signing_token}`
    : null;

  function copySigningLink() {
    if (!signingUrl) return;
    navigator.clipboard.writeText(signingUrl);
    toast.success("Signing link copied");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Contracts</h1>
          <p className="text-xs text-muted-foreground">Send contracts for e-signature directly from Cineflow.</p>
        </div>
        <Button variant="gold" size="sm" className="h-9 gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" />
          New Contract
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: contract list */}
        <aside className="hidden w-72 flex-col border-r border-border bg-card/70 overflow-y-auto custom-scrollbar sm:flex">
          {loading ? (
            <p className="p-4 text-xs text-muted-foreground">Loading…</p>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
              <FileSignature className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No contracts yet.</p>
              <button onClick={openNew} className="text-xs text-[#d4a853] hover:underline">Create your first</button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {contracts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`group w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
                    selected?.id === c.id
                      ? "border-[#d4a853] bg-[#d4a853]/10"
                      : "border-border bg-card hover:border-[#d4a853]/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${selected?.id === c.id ? "text-foreground" : "text-foreground/80"}`}>
                        {c.title}
                      </p>
                      {c.recipient_name && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.recipient_name}</p>
                      )}
                      <div className="mt-1.5">
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                      className="shrink-0 rounded p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Right: contract detail */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border">
                <FileSignature className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="font-display font-semibold text-foreground">No contract selected</p>
              <p className="text-sm text-muted-foreground">Create a contract and send it for e-signature.</p>
              <Button variant="gold" size="sm" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                New Contract
              </Button>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-6">
              {/* Contract header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-xl font-semibold text-foreground">{selected.title}</h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  {selected.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                  )}
                  {(selected.project as any)?.title && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Project: <span className="text-foreground">{(selected.project as any).title}</span>
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-col gap-2">
                  {(selected.status === "draft" || selected.status === "sent") && (
                    <Button
                      variant="gold"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleSend}
                      disabled={sending || !selected.recipient_email}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {sending ? "Sending…" : selected.status === "sent" ? "Resend" : "Send for Signature"}
                    </Button>
                  )}
                  {selected.status === "signed" && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Signed
                      {selected.signed_at && <span className="text-emerald-400/70">· {new Date(selected.signed_at).toLocaleDateString()}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Recipient info */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recipient</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Name</p>
                    <p className="text-sm text-foreground">{selected.recipient_name || <span className="text-muted-foreground/40">—</span>}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Email</p>
                    <p className="text-sm text-foreground">{selected.recipient_email || <span className="text-muted-foreground/40">—</span>}</p>
                  </div>
                </div>
                {!selected.recipient_email && (
                  <p className="mt-2 text-xs text-amber-400">Add a recipient email to send this contract.</p>
                )}
              </div>

              {/* Signing link */}
              {signingUrl && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Signing Link</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <p className="truncate text-xs text-muted-foreground font-mono">{signingUrl}</p>
                    </div>
                    <button
                      onClick={copySigningLink}
                      className="shrink-0 rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Copy link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={signingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Open signing page"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground/60">Share this link directly or send it via email above.</p>
                </div>
              )}

              {/* PDF preview */}
              {selected.file_url && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Document</p>
                    <a
                      href={selected.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <iframe
                      src={selected.file_url}
                      className="h-[500px] w-full bg-white"
                      title="Contract document"
                    />
                  </div>
                </div>
              )}

              {!selected.file_url && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No document uploaded</p>
                  <p className="text-xs text-muted-foreground/60">Upload a PDF when creating the contract.</p>
                </div>
              )}

              {/* Timeline */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Timeline</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Created {new Date(selected.created_at).toLocaleDateString()}
                  </div>
                  {selected.sent_at && (
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <Send className="h-3.5 w-3.5 shrink-0" />
                      Sent {new Date(selected.sent_at).toLocaleDateString()}
                    </div>
                  )}
                  {selected.signed_at && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Signed {new Date(selected.signed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* New Contract Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Contract</DialogTitle>
            <DialogDescription>Upload a PDF and set the recipient. They'll get a signing link via email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Service Agreement — Protetta" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={fDescription} onChange={(e) => setFDescription(e.target.value)} rows={2} placeholder="Brief summary of what this contract covers…" />
            </div>
            <div className="space-y-1.5">
              <Label>Project <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="relative">
                <select
                  value={fProject}
                  onChange={(e) => setFProject(e.target.value)}
                  className="w-full appearance-none rounded-md border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Recipient Name</Label>
                <Input value={fRecipientName} onChange={(e) => setFRecipientName(e.target.value)} placeholder="Sarah Chen" />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient Email</Label>
                <Input type="email" value={fRecipientEmail} onChange={(e) => setFRecipientEmail(e.target.value)} placeholder="sarah@meridianfilms.com" />
              </div>
            </div>
            {/* PDF upload */}
            <div className="space-y-1.5">
              <Label>Contract PDF <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/50 py-6 text-center transition-colors hover:border-[#d4a853]/40 hover:bg-[#d4a853]/[0.03]"
              >
                {fFile ? (
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#d4a853]" />
                    <span className="text-sm text-foreground">{fFile.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFFile(null); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-2 h-6 w-6 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Click to upload PDF</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">PDF · Max 20MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => setFFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleCreate} disabled={creating || !fTitle.trim()}>
              {creating ? "Creating…" : "Create Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
