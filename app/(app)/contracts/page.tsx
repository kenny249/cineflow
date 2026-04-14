"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, FileSignature, Send, Trash2, CheckCircle2,
  FileText, Upload, Copy, ExternalLink, X, ChevronDown, Pencil,
  Download, PenLine, RotateCcw, Loader2, MousePointer, Users,
  FolderOpen, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getProjects } from "@/lib/supabase/queries";
import dynamic from "next/dynamic";
import type { Contract, ContractStatus, ContractRecipientRole, Project, SignatureField } from "@/types";
// Load PDFViewer client-only — pdfjs-dist uses Node canvas which breaks SSR
const PDFViewer = dynamic(
  () => import("@/components/contracts/PDFViewer").then((m) => m.PDFViewer),
  { ssr: false, loading: () => <div className="flex h-[560px] items-center justify-center bg-zinc-100 dark:bg-zinc-900"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> }
);

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

const ROLE_CONFIG: Record<ContractRecipientRole, { label: string; color: string }> = {
  client:   { label: "Client",   color: "text-[#d4a853] bg-[#d4a853]/10" },
  crew:     { label: "Crew",     color: "text-blue-400 bg-blue-400/10" },
  talent:   { label: "Talent",   color: "text-purple-400 bg-purple-400/10" },
  location: { label: "Location", color: "text-emerald-400 bg-emerald-400/10" },
  vendor:   { label: "Vendor",   color: "text-orange-400 bg-orange-400/10" },
  other:    { label: "Other",    color: "text-muted-foreground bg-muted/60" },
};

function RoleBadge({ role }: { role?: ContractRecipientRole | string }) {
  const cfg = ROLE_CONFIG[(role as ContractRecipientRole) ?? "client"] ?? ROLE_CONFIG.client;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

const ALL_ROLES: ContractRecipientRole[] = ["client", "crew", "talent", "location", "vendor", "other"];

export default function ContractsPage() {
  const supabase = createClient();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contract | null>(null);

  // Sidebar project grouping
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  // New contract dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fProject, setFProject] = useState("");
  const [fRecipientName, setFRecipientName] = useState("");
  const [fRecipientEmail, setFRecipientEmail] = useState("");
  const [fRecipientRole, setFRecipientRole] = useState<ContractRecipientRole>("client");
  const [fFile, setFFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit contract dialog
  const [editOpen, setEditOpen] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eProject, setEProject] = useState("");
  const [eRecipientName, setERecipientName] = useState("");
  const [eRecipientEmail, setERecipientEmail] = useState("");
  const [eRecipientRole, setERecipientRole] = useState<ContractRecipientRole>("client");
  const [saving, setSaving] = useState(false);

  // Send state
  const [sending, setSending] = useState(false);

  // Field placement
  const [dropMode, setDropMode] = useState<"sender" | "recipient" | null>(null);
  const [localFields, setLocalFields] = useState<SignatureField[]>([]);
  const [savingFields, setSavingFields] = useState(false);

  // Sender (agency) signing
  const [showSenderSign, setShowSenderSign] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [savingSenderSig, setSavingSenderSig] = useState(false);
  const senderCanvasRef = useRef<HTMLCanvasElement>(null);
  const [senderDrawing, setSenderDrawing] = useState(false);
  const [hasSenderSig, setHasSenderSig] = useState(false);
  const senderLastPos = useRef<{ x: number; y: number } | null>(null);
  const [senderSigMode, setSenderSigMode] = useState<"draw" | "type">("draw");
  const [senderTypedName, setSenderTypedName] = useState("");


  // Stamp state
  const [stamping, setStamping] = useState(false);

  // Inline sign modal (click a field → sign it right here)
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signModalField, setSignModalField] = useState<SignatureField | null>(null);
  const inlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const [inlineDrawing, setInlineDrawing] = useState(false);
  const [hasInlineSig, setHasInlineSig] = useState(false);
  const inlineLastPos = useRef<{ x: number; y: number } | null>(null);
  const [inlineSigMode, setInlineSigMode] = useState<"draw" | "type">("draw");
  const [inlineTypedName, setInlineTypedName] = useState("");
  const [inlineSignerName, setInlineSignerName] = useState("");
  const [savingInlineSig, setSavingInlineSig] = useState(false);

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

  // Sync local field state when selected contract changes
  useEffect(() => {
    setLocalFields(selected?.signature_fields ?? []);
    setSenderName(selected?.sender_name ?? "");
    setDropMode(null);
    setShowSenderSign(false);
    setHasSenderSig(false);
    if (senderCanvasRef.current) {
      const ctx = senderCanvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, senderCanvasRef.current.width, senderCanvasRef.current.height);
    }
  }, [selected?.id]);

  function openNew() {
    setFTitle(""); setFDescription(""); setFProject("");
    setFRecipientName(""); setFRecipientEmail(""); setFFile(null);
    setFRecipientRole("client");
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
          recipient_role: fRecipientRole,
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
  }, [fTitle, fDescription, fProject, fRecipientName, fRecipientEmail, fRecipientRole, fFile]);

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

  function openEdit() {
    if (!selected) return;
    setETitle(selected.title);
    setEDescription(selected.description ?? "");
    setEProject((selected.project as any)?.id ?? selected.project_id ?? "");
    setERecipientName(selected.recipient_name ?? "");
    setERecipientEmail(selected.recipient_email ?? "");
    setERecipientRole((selected.recipient_role as ContractRecipientRole) ?? "client");
    setEditOpen(true);
  }

  const handleSave = useCallback(async () => {
    if (!selected || !eTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          title: eTitle.trim(),
          description: eDescription.trim() || null,
          project_id: eProject || null,
          recipient_name: eRecipientName.trim() || null,
          recipient_email: eRecipientEmail.trim() || null,
          recipient_role: eRecipientRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContracts((prev) => prev.map((c) => c.id === selected.id ? data.contract : c));
      setSelected(data.contract);
      setEditOpen(false);
      toast.success("Contract updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }, [selected, eTitle, eDescription, eProject, eRecipientName, eRecipientEmail]);

  // ── Field placement ──────────────────────────────────────────────────────────
  function handleFieldPlace(field: Omit<SignatureField, "id">) {
    const id = crypto.randomUUID();
    setLocalFields((prev) => [...prev, { ...field, id }]);
    setDropMode(null); // auto-deactivate after placing one field
  }

  function removeField(id: string) {
    setLocalFields((prev) => prev.filter((f) => f.id !== id));
  }

  const handleSaveFields = useCallback(async () => {
    if (!selected) return;
    setSavingFields(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, signature_fields: localFields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...selected, signature_fields: localFields };
      setContracts((prev) => prev.map((c) => c.id === selected.id ? updated : c));
      setSelected(updated);
      toast.success("Fields saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save fields");
    } finally {
      setSavingFields(false);
    }
  }, [selected, localFields]);

  // ── Sender canvas helpers ─────────────────────────────────────────────────
  function getSenderPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = senderCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startSenderDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setSenderDrawing(true);
    senderLastPos.current = getSenderPos(e);
  }

  function drawSender(e: React.MouseEvent | React.TouchEvent) {
    if (!senderDrawing) return;
    e.preventDefault();
    const canvas = senderCanvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getSenderPos(e);
    ctx.beginPath();
    ctx.moveTo(senderLastPos.current!.x, senderLastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    senderLastPos.current = pos;
    setHasSenderSig(true);
  }

  function stopSenderDraw() {
    setSenderDrawing(false);
    senderLastPos.current = null;
  }

  function clearSenderCanvas() {
    const canvas = senderCanvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSenderSig(false);
  }

  // Render typed name as a cursive-style signature onto the canvas
  function renderTypedSenderSig(name: string) {
    const canvas = senderCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!name.trim()) { setHasSenderSig(false); return; }
    ctx.font = "italic 48px Palatino Linotype, Palatino, Book Antiqua, Georgia, serif";
    ctx.fillStyle = "#18181b";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(name).width;
    const x = Math.max(16, (canvas.width - tw) / 2);
    const y = canvas.height / 2;
    ctx.fillText(name, x, y);
    // Subtle underline
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 26);
    ctx.lineTo(x + tw + 8, y + 26);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 1;
    ctx.stroke();
    setHasSenderSig(true);
  }

  // Auto-detect callback from PDFViewer
  function handleAutoDetect(detected: Omit<SignatureField, "id">[]) {
    if (localFields.length === 0) {
      // No fields yet — apply automatically
      const withIds = detected.map((f) => ({ ...f, id: crypto.randomUUID() }));
      setLocalFields(withIds);
      toast.success(`Auto-detected ${withIds.length} signature field${withIds.length !== 1 ? "s" : ""} — review and save`);
    } else {
      // Fields already exist — offer to replace via toast action
      toast(`Found ${detected.length} signature field${detected.length !== 1 ? "s" : ""} in document`, {
        description: "Replace existing fields with auto-detected ones?",
        action: {
          label: "Replace",
          onClick: () => {
            const withIds = detected.map((f) => ({ ...f, id: crypto.randomUUID() }));
            setLocalFields(withIds);
          },
        },
      });
    }
  }

  const handleSaveSenderSig = useCallback(async () => {
    if (!selected || !hasSenderSig || !senderName.trim()) return;
    setSavingSenderSig(true);
    try {
      const signatureData = senderCanvasRef.current!.toDataURL("image/png");
      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          sender_name: senderName.trim(),
          sender_signature_data: signatureData,
          sender_signed_at: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...selected, ...data.contract };
      setContracts((prev) => prev.map((c) => c.id === selected.id ? updated : c));
      setSelected(updated);
      setShowSenderSign(false);
      toast.success("Your signature saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save signature");
    } finally {
      setSavingSenderSig(false);
    }
  }, [selected, hasSenderSig, senderName]);

  // ── Inline sign modal helpers ─────────────────────────────────────────────

  function openSignModal(field: SignatureField) {
    setSignModalField(field);
    setInlineSigMode("draw");
    setInlineTypedName("");
    setHasInlineSig(false);
    setInlineSignerName(
      field.role === "sender"
        ? (selected?.sender_name ?? "")
        : (selected?.recipient_name ?? "")
    );
    setSignModalOpen(true);
    // Clear canvas on next tick after modal renders
    setTimeout(() => {
      const c = inlineCanvasRef.current;
      if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    }, 50);
  }

  function getInlinePos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = inlineCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startInlineDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setInlineDrawing(true);
    inlineLastPos.current = getInlinePos(e);
  }

  function drawInline(e: React.MouseEvent | React.TouchEvent) {
    if (!inlineDrawing) return;
    e.preventDefault();
    const canvas = inlineCanvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getInlinePos(e);
    ctx.beginPath();
    ctx.moveTo(inlineLastPos.current!.x, inlineLastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    inlineLastPos.current = pos;
    setHasInlineSig(true);
  }

  function stopInlineDraw() { setInlineDrawing(false); inlineLastPos.current = null; }

  function clearInlineCanvas() {
    const c = inlineCanvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInlineSig(false);
    setInlineTypedName("");
  }

  function renderInlineTyped(name: string) {
    const canvas = inlineCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!name.trim()) { setHasInlineSig(false); return; }
    ctx.font = "italic 48px Palatino Linotype, Palatino, Book Antiqua, Georgia, serif";
    ctx.fillStyle = "#18181b";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(name).width;
    const x = Math.max(16, (canvas.width - tw) / 2);
    const y = canvas.height / 2;
    ctx.fillText(name, x, y);
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 26);
    ctx.lineTo(x + tw + 8, y + 26);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 1;
    ctx.stroke();
    setHasInlineSig(true);
  }

  const handleSaveInlineSig = useCallback(async () => {
    if (!selected || !hasInlineSig || !inlineSignerName.trim() || !signModalField) return;
    setSavingInlineSig(true);
    try {
      const signatureData = inlineCanvasRef.current!.toDataURL("image/png");
      const isSender = signModalField.role === "sender";

      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSender
            ? { id: selected.id, sender_name: inlineSignerName.trim(), sender_signature_data: signatureData, sender_signed_at: new Date().toISOString() }
            : { id: selected.id, recipient_name: inlineSignerName.trim(), status: "signed", signed_at: new Date().toISOString() }
        ),
      });

      // If recipient in-person signing: also save to contract_signatures
      if (!isSender) {
        await fetch(`/api/contracts/sign?token=${selected.signing_token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signer_name: inlineSignerName.trim(), signature_data: signatureData }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...selected, ...data.contract };
      setContracts((prev) => prev.map((c) => c.id === selected.id ? updated : c));
      setSelected(updated);
      setSignModalOpen(false);
      toast.success(isSender ? "Your signature saved" : "Contract signed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingInlineSig(false);
    }
  }, [selected, hasInlineSig, inlineSignerName, signModalField]);

  // ── Stamp (generate signed PDF) ────────────────────────────────────────────
  const handleStamp = useCallback(async () => {
    if (!selected) return;
    setStamping(true);
    try {
      const res = await fetch("/api/contracts/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...selected, signed_pdf_url: data.signed_pdf_url };
      setContracts((prev) => prev.map((c) => c.id === selected.id ? updated : c));
      setSelected(updated);
      toast.success("Signed PDF generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setStamping(false);
    }
  }, [selected]);

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
          ) : (() => {
            // Group contracts by project
            const groups: { key: string; label: string; contracts: Contract[] }[] = [];
            const seen = new Set<string>();
            for (const c of contracts) {
              const key = (c.project as any)?.id ?? "none";
              const label = (c.project as any)?.title ?? "No Project";
              if (!seen.has(key)) {
                seen.add(key);
                groups.push({ key, label, contracts: [] });
              }
              groups.find((g) => g.key === key)!.contracts.push(c);
            }
            return (
              <div className="p-2 space-y-1">
                {groups.map(({ key, label, contracts: groupContracts }) => {
                  const isExpanded = expandedProjects[key] !== false; // default open
                  return (
                    <div key={key} className="space-y-0.5">
                      {/* Project group header */}
                      <button
                        onClick={() => setExpandedProjects((p) => ({ ...p, [key]: !isExpanded }))}
                        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
                      >
                        {isExpanded
                          ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                          : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        }
                        <FolderOpen className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="flex-1 truncate text-[11px] font-semibold text-muted-foreground">{label}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground/50">{groupContracts.length}</span>
                      </button>
                      {isExpanded && groupContracts.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelected(c)}
                          className={`group ml-4 w-[calc(100%-1rem)] rounded-xl border px-3 py-2.5 text-left transition-all ${
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
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                <StatusBadge status={c.status} />
                                <RoleBadge role={c.recipient_role} />
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
                  );
                })}
              </div>
            );
          })()}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-xl font-semibold text-foreground">{selected.title}</h2>
                    <StatusBadge status={selected.status} />
                    <RoleBadge role={selected.recipient_role} />
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
                  {selected.status === "draft" && signingUrl && (
                    <a
                      href={signingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Sign yourself
                    </a>
                  )}
                  {selected.status !== "signed" && (
                    <button
                      onClick={openEdit}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}
                  {selected.status === "signed" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Signed
                        {selected.signed_at && <span className="text-emerald-400/70">· {new Date(selected.signed_at).toLocaleDateString()}</span>}
                      </div>
                      {selected.signing_token && (
                        <a
                          href={`/sign/${selected.signing_token}/certificate`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/[0.1] transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View Certificate
                        </a>
                      )}
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

              {/* PDF viewer + field placement */}
              {selected.file_url ? (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  {/* Field placement toolbar */}
                  {selected.status !== "signed" && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 bg-card/80">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mr-1">
                        {localFields.length === 0 ? "Place Signature Fields" : "Signature Fields"}
                      </span>
                      {localFields.length === 0 && (
                        <span className="text-[10px] text-muted-foreground/60">— click a button below, then click the PDF where you want the field</span>
                      )}

                      {/* Sender field button */}
                      <button
                        onClick={() => setDropMode(dropMode === "sender" ? null : "sender")}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          dropMode === "sender"
                            ? "border-[#d4a853] bg-[#d4a853]/15 text-[#d4a853]"
                            : "border-border text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground"
                        }`}
                      >
                        <MousePointer className="h-3 w-3" />
                        {dropMode === "sender" ? "Click PDF to place…" : "Add Your Field"}
                        {localFields.filter((f) => f.role === "sender").length > 0 && (
                          <span className="rounded-full bg-[#d4a853]/20 px-1.5 text-[10px] text-[#d4a853]">
                            {localFields.filter((f) => f.role === "sender").length}
                          </span>
                        )}
                      </button>

                      {/* Recipient field button */}
                      <button
                        onClick={() => setDropMode(dropMode === "recipient" ? null : "recipient")}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          dropMode === "recipient"
                            ? "border-sky-400 bg-sky-400/15 text-sky-400"
                            : "border-border text-muted-foreground hover:border-sky-400/40 hover:text-foreground"
                        }`}
                      >
                        <Users className="h-3 w-3" />
                        {dropMode === "recipient" ? "Click PDF to place…" : "Add Recipient Field"}
                        {localFields.filter((f) => f.role === "recipient").length > 0 && (
                          <span className="rounded-full bg-sky-400/20 px-1.5 text-[10px] text-sky-400">
                            {localFields.filter((f) => f.role === "recipient").length}
                          </span>
                        )}
                      </button>

                      {/* Field list — remove individual fields */}
                      {localFields.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 ml-1">
                          {localFields.map((f) => (
                            <span
                              key={f.id}
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                                f.role === "sender"
                                  ? "bg-[#d4a853]/10 text-[#d4a853]"
                                  : "bg-sky-400/10 text-sky-400"
                              }`}
                            >
                              p.{f.page} {f.role === "sender" ? "You" : "Client"}
                              <button onClick={() => removeField(f.id)} className="hover:opacity-70">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="ml-auto flex items-center gap-2">
                        {/* Sign now button — shown when fields exist and contract not signed */}
                        {localFields.length > 0 && (
                          <button
                            onClick={() => openSignModal(localFields[0])}
                            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1 text-xs font-bold text-black hover:bg-[#c49843] transition-colors"
                          >
                            <PenLine className="h-3 w-3" /> Sign Now
                          </button>
                        )}
                        {/* Save fields button — only if fields changed */}
                        {JSON.stringify(localFields) !== JSON.stringify(selected.signature_fields ?? []) && (
                          <button
                            onClick={handleSaveFields}
                            disabled={savingFields}
                            className="flex items-center gap-1.5 rounded-lg bg-foreground/5 border border-border px-2.5 py-1 text-xs font-medium hover:bg-foreground/10 transition-colors"
                          >
                            {savingFields ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Save fields
                          </button>
                        )}
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
                    </div>
                  )}

                  {/* PDF viewer */}
                  <PDFViewer
                    url={selected.file_url}
                    fields={localFields}
                    dropMode={dropMode}
                    onFieldPlace={handleFieldPlace}
                    onAutoDetect={handleAutoDetect}
                    onFieldClick={(field) => {
                      if (selected.status === "signed") return;
                      openSignModal(field);
                    }}
                    className="h-[720px]"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No document uploaded</p>
                  <p className="text-xs text-muted-foreground/60">Upload a PDF when creating the contract.</p>
                </div>
              )}

              {/* Sender (agency) signing panel */}
              {selected.file_url && selected.status !== "signed" && localFields.some((f) => f.role === "sender") && (
                <div className="rounded-xl border border-border bg-card p-4">
                  {selected.sender_signed_at ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d4a853]/10">
                        <CheckCircle2 className="h-4 w-4 text-[#d4a853]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Your signature collected</p>
                        <p className="text-xs text-muted-foreground">
                          {selected.sender_name} · {new Date(selected.sender_signed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowSenderSign(true)}
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Re-sign
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <PenLine className="h-4 w-4 text-[#d4a853]" />
                        <p className="text-sm font-semibold text-foreground">Sign your field</p>
                        <span className="text-xs text-muted-foreground">— sign before sending to client</span>
                      </div>
                      {!showSenderSign ? (
                        <button
                          onClick={() => setShowSenderSign(true)}
                          className="flex items-center gap-2 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/5 px-4 py-2 text-sm font-medium text-[#d4a853] hover:bg-[#d4a853]/10 transition-colors"
                        >
                          <PenLine className="h-3.5 w-3.5" /> Sign Document
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Your Name</Label>
                            <Input
                              value={senderName}
                              onChange={(e) => {
                                setSenderName(e.target.value);
                                if (senderSigMode === "type") {
                                  setSenderTypedName(e.target.value);
                                  renderTypedSenderSig(e.target.value);
                                }
                              }}
                              placeholder="Your full name"
                              className="h-8 text-sm"
                            />
                          </div>
                          {/* Draw / Type tabs */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => { setSenderSigMode("draw"); clearSenderCanvas(); }}
                                  className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${senderSigMode === "draw" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                  <PenLine className="h-3 w-3" /> Draw
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSenderSigMode("type");
                                    setSenderTypedName(senderName);
                                    renderTypedSenderSig(senderName);
                                  }}
                                  className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${senderSigMode === "type" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                  <span className="font-serif italic text-sm leading-none">T</span> Type
                                </button>
                              </div>
                              {hasSenderSig && (
                                <button onClick={clearSenderCanvas} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                                  <RotateCcw className="h-3 w-3" /> Clear
                                </button>
                              )}
                            </div>
                            {senderSigMode === "type" ? (
                              <div className="space-y-2">
                                <Input
                                  value={senderTypedName}
                                  onChange={(e) => {
                                    setSenderTypedName(e.target.value);
                                    renderTypedSenderSig(e.target.value);
                                  }}
                                  placeholder="Type your name to sign…"
                                  className="h-8 text-sm font-medium"
                                />
                                {/* Canvas preview (hidden but rendered for export) */}
                                <div className={`relative overflow-hidden rounded-xl border-2 ${hasSenderSig ? "border-[#d4a853]" : "border-border"} bg-white`}>
                                  <canvas ref={senderCanvasRef} width={560} height={140} className="w-full" />
                                  {!hasSenderSig && (
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                      <p className="font-serif italic text-lg text-zinc-300">Your name will appear here</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className={`relative overflow-hidden rounded-xl border-2 transition-colors ${senderDrawing ? "border-[#d4a853]" : "border-border"} bg-white`}>
                                <canvas
                                  ref={senderCanvasRef}
                                  width={560}
                                  height={140}
                                  className="w-full touch-none cursor-crosshair"
                                  onMouseDown={startSenderDraw}
                                  onMouseMove={drawSender}
                                  onMouseUp={stopSenderDraw}
                                  onMouseLeave={stopSenderDraw}
                                  onTouchStart={startSenderDraw}
                                  onTouchMove={drawSender}
                                  onTouchEnd={stopSenderDraw}
                                />
                                {!hasSenderSig && (
                                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <p className="text-sm text-zinc-300">Draw your signature here</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setShowSenderSign(false); clearSenderCanvas(); setSenderSigMode("draw"); setSenderTypedName(""); }}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveSenderSig}
                              disabled={savingSenderSig || !hasSenderSig || !senderName.trim()}
                              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors"
                            >
                              {savingSenderSig ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Confirm Signature
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Signed PDF download */}
              {(selected.signed_pdf_url || selected.status === "signed") && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Fully Executed Contract</p>
                        <p className="text-xs text-muted-foreground">Both parties have signed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selected.signed_pdf_url ? (
                        <a
                          href={selected.signed_pdf_url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Signed PDF
                        </a>
                      ) : (
                        <button
                          onClick={handleStamp}
                          disabled={stamping}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                        >
                          {stamping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          Generate Signed PDF
                        </button>
                      )}
                      {selected.signing_token && (
                        <a
                          href={`/sign/${selected.signing_token}/certificate`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Certificate
                        </a>
                      )}
                    </div>
                  </div>
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
                  {selected.sender_signed_at && (
                    <div className="flex items-center gap-2 text-xs text-[#d4a853]">
                      <PenLine className="h-3.5 w-3.5 shrink-0" />
                      You signed · {selected.sender_name} · {new Date(selected.sender_signed_at).toLocaleDateString()}
                    </div>
                  )}
                  {selected.sent_at && (
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <Send className="h-3.5 w-3.5 shrink-0" />
                      Sent to {selected.recipient_name ?? selected.recipient_email} · {new Date(selected.sent_at).toLocaleDateString()}
                    </div>
                  )}
                  {selected.signed_at && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      {selected.recipient_name ?? "Client"} signed · {new Date(selected.signed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Inline Sign Modal ─────────────────────────────────────────────── */}
      <Dialog open={signModalOpen} onOpenChange={(v) => { if (!v) { setSignModalOpen(false); clearInlineCanvas(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-4 w-4 text-[#d4a853]" />
              {signModalField?.role === "sender" ? "Sign as Agency" : "Sign as Recipient"}
            </DialogTitle>
            <DialogDescription>
              {signModalField?.role === "sender"
                ? "Add your signature to this field — you'll send the contract to the client afterward."
                : "Signing on behalf of the recipient in-person."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={inlineSignerName}
                onChange={(e) => {
                  setInlineSignerName(e.target.value);
                  if (inlineSigMode === "type") renderInlineTyped(e.target.value);
                }}
                placeholder="Legal name"
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            {/* Draw / Type toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => { setInlineSigMode("draw"); clearInlineCanvas(); }}
                    className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${inlineSigMode === "draw" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <PenLine className="h-3 w-3" /> Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInlineSigMode("type"); setInlineTypedName(inlineSignerName); renderInlineTyped(inlineSignerName); }}
                    className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${inlineSigMode === "type" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span className="font-serif italic text-sm leading-none">T</span> Type
                  </button>
                </div>
                {hasInlineSig && (
                  <button onClick={clearInlineCanvas} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>

              {inlineSigMode === "type" ? (
                <div className="space-y-2">
                  <Input
                    value={inlineTypedName}
                    onChange={(e) => { setInlineTypedName(e.target.value); renderInlineTyped(e.target.value); }}
                    placeholder="Type your name…"
                    className="h-8 text-sm"
                  />
                  <div className={`relative overflow-hidden rounded-xl border-2 ${hasInlineSig ? "border-[#d4a853]" : "border-border"} bg-white`}>
                    <canvas ref={inlineCanvasRef} width={480} height={130} className="w-full" />
                    {!hasInlineSig && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <p className="font-serif italic text-base text-zinc-300">Signature preview</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`relative overflow-hidden rounded-xl border-2 transition-colors ${inlineDrawing ? "border-[#d4a853]" : "border-border"} bg-white`}>
                  <canvas
                    ref={inlineCanvasRef}
                    width={480}
                    height={130}
                    className="w-full touch-none cursor-crosshair"
                    onMouseDown={startInlineDraw}
                    onMouseMove={drawInline}
                    onMouseUp={stopInlineDraw}
                    onMouseLeave={stopInlineDraw}
                    onTouchStart={startInlineDraw}
                    onTouchMove={drawInline}
                    onTouchEnd={stopInlineDraw}
                  />
                  {!hasInlineSig && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-zinc-300">Draw your signature here</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setSignModalOpen(false); clearInlineCanvas(); }}>Cancel</Button>
            <Button
              variant="gold"
              size="sm"
              onClick={handleSaveInlineSig}
              disabled={savingInlineSig || !hasInlineSig || !inlineSignerName.trim()}
            >
              {savingInlineSig ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Saving…</> : <><CheckCircle2 className="mr-1.5 h-3 w-3" />Confirm Signature</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contract Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
            <DialogDescription>Update contract details and recipient info.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={eTitle} onChange={(e) => setETitle(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Project <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="relative">
                <select
                  value={eProject}
                  onChange={(e) => setEProject(e.target.value)}
                  className="w-full appearance-none rounded-md border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Signer Role</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setERecipientRole(r)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                      eRecipientRole === r
                        ? ROLE_CONFIG[r].color + " ring-1 ring-current"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {ROLE_CONFIG[r].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Recipient Name</Label>
                <Input value={eRecipientName} onChange={(e) => setERecipientName(e.target.value)} placeholder="Sarah Chen" />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient Email</Label>
                <Input type="email" value={eRecipientEmail} onChange={(e) => setERecipientEmail(e.target.value)} placeholder="sarah@meridianfilms.com" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleSave} disabled={saving || !eTitle.trim()}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {/* Recipient role */}
            <div className="space-y-1.5">
              <Label>Signer Role</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFRecipientRole(r)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                      fRecipientRole === r
                        ? ROLE_CONFIG[r].color + " ring-1 ring-current"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {ROLE_CONFIG[r].label}
                  </button>
                ))}
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
