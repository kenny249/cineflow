"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ExternalLink, CheckCircle2, Circle, Link2, X, Film, Youtube, Globe, Mic, Image, ChevronDown, Copy, Check, Eye } from "lucide-react";
import { toast } from "sonner";
import { getVideoDeliverables, createVideoDeliverable, updateVideoDeliverable, deleteVideoDeliverable, getOrCreateClientPortal, getClientPortal } from "@/lib/supabase/queries";
import type { VideoDeliverable, VideoDeliverableType, ClientPortal } from "@/types";

const TYPE_OPTIONS: { value: VideoDeliverableType; label: string }[] = [
  { value: "short",     label: "Short / Reel" },
  { value: "youtube",   label: "YouTube" },
  { value: "web_video", label: "Web Video" },
  { value: "podcast",   label: "Podcast" },
  { value: "photo",     label: "Photo / Gallery" },
  { value: "other",     label: "Other" },
];

const TYPE_COLORS: Record<VideoDeliverableType, string> = {
  short:     "bg-rose-500/10 text-rose-400 border-rose-500/20",
  youtube:   "bg-red-500/10 text-red-400 border-red-500/20",
  web_video: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  podcast:   "bg-purple-500/10 text-purple-400 border-purple-500/20",
  photo:     "bg-amber-500/10 text-amber-400 border-amber-500/20",
  other:     "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const TYPE_ICONS: Record<VideoDeliverableType, React.ReactNode> = {
  short:     <Film className="h-3 w-3" />,
  youtube:   <Youtube className="h-3 w-3" />,
  web_video: <Globe className="h-3 w-3" />,
  podcast:   <Mic className="h-3 w-3" />,
  photo:     <Image className="h-3 w-3" />,
  other:     <Link2 className="h-3 w-3" />,
};

function detectPlatform(url: string): string {
  if (url.includes("vimeo.com")) return "Vimeo";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("drive.google.com")) return "Google Drive";
  if (url.includes("dropbox.com")) return "Dropbox";
  if (url.includes("frame.io")) return "Frame.io";
  try { return new URL(url).hostname.replace("www.", ""); } catch { return "Link"; }
}

const EMPTY_FORM = { title: "", type: "other" as VideoDeliverableType, url: "", notes: "" };

interface Props {
  projectId: string;
  clientName?: string;
}

export function VideoDeliverablesTab({ projectId, clientName }: Props) {
  const [items, setItems] = useState<VideoDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Portal state
  const [portal, setPortal] = useState<ClientPortal | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getVideoDeliverables(projectId)
      .then(setItems)
      .catch(() => toast.error("Failed to load deliverables"))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!clientName) return;
    getClientPortal(clientName).then(setPortal).catch(() => {});
  }, [clientName]);

  async function handleCreatePortal() {
    if (!clientName) return;
    setPortalLoading(true);
    try {
      const p = await getOrCreateClientPortal(clientName);
      setPortal(p);
      const url = `${window.location.origin}/client/${p.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      toast.success("Portal created — link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to create portal");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!portal) return;
    const url = `${window.location.origin}/client/${portal.token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    toast.success("Portal link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("Title and URL are required");
      return;
    }
    setSaving(true);
    try {
      const created = await createVideoDeliverable({
        project_id: projectId,
        title: form.title.trim(),
        type: form.type,
        url: form.url.trim(),
        notes: form.notes.trim() || undefined,
      });
      setItems((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success("Deliverable added");
    } catch {
      toast.error("Failed to add deliverable");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(item: VideoDeliverable) {
    const next = item.status === "delivered" ? "draft" : "delivered";
    setToggling(item.id);
    try {
      await updateVideoDeliverable(item.id, {
        status: next,
        delivered_at: next === "delivered" ? new Date().toISOString() : undefined,
      });
      setItems((prev) => prev.map((d) => d.id === item.id ? { ...d, status: next, delivered_at: next === "delivered" ? new Date().toISOString() : undefined } : d));
      toast.success(next === "delivered" ? "Marked as delivered — visible in client portal" : "Moved back to draft");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteVideoDeliverable(id);
      setItems((prev) => prev.filter((d) => d.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  const delivered = items.filter((d) => d.status === "delivered");
  const drafts    = items.filter((d) => d.status === "draft");

  const portalUrl = portal ? `${typeof window !== "undefined" ? window.location.origin : ""}/client/${portal.token}` : null;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Client Portal Banner */}
      {clientName && (
        <div className={`rounded-xl border p-3.5 ${portal ? "border-[#d4a853]/20 bg-[#d4a853]/5" : "border-border bg-card/50"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {portal ? "Client Portal Active" : "No client portal yet"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {portal
                  ? `Delivered items visible at /client/${portal.token.slice(0, 8)}…`
                  : `Create a portal link to share with ${clientName}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {portal ? (
                <>
                  <a
                    href={portalUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 px-2.5 py-1.5 text-[11px] font-medium text-[#d4a853] hover:bg-[#d4a853]/10 transition-colors"
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleCreatePortal}
                  disabled={portalLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-[#c49843] disabled:opacity-60 transition-colors"
                >
                  {portalLoading
                    ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    : <Link2 className="h-3 w-3" />}
                  Create portal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">Final Deliverables</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Add final cuts here. Mark as delivered to make them visible in the client portal.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#d4a853]">New Deliverable</p>
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] text-muted-foreground uppercase tracking-wide">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Brand Launch 30s"
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-muted-foreground uppercase tracking-wide">Type</label>
                <div className="relative">
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as VideoDeliverableType })}
                    className="w-full appearance-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                  >
                    {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground uppercase tracking-wide">URL *</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://vimeo.com/… or drive.google.com/…"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground uppercase tracking-wide">Notes (optional)</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Final color grade, 1080p"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-60"
              >
                {saving && <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />}
                Add Deliverable
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
          <Film className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm font-semibold text-foreground">No deliverables yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Add final video links here. Mark them as delivered and they'll automatically appear in your client's portal.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 px-3 py-1.5 text-xs text-[#d4a853] hover:bg-[#d4a853]/10"
          >
            <Plus className="h-3.5 w-3.5" />
            Add first deliverable
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {/* Delivered */}
          {delivered.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-400/70">
                Delivered ({delivered.length})
              </p>
              <div className="space-y-2">
                {delivered.map((item) => (
                  <DeliverableRow
                    key={item.id}
                    item={item}
                    onToggle={handleToggleStatus}
                    onDelete={handleDelete}
                    toggling={toggling === item.id}
                    deleting={deleting === item.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Drafts */}
          {drafts.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Draft ({drafts.length})
              </p>
              <div className="space-y-2">
                {drafts.map((item) => (
                  <DeliverableRow
                    key={item.id}
                    item={item}
                    onToggle={handleToggleStatus}
                    onDelete={handleDelete}
                    toggling={toggling === item.id}
                    deleting={deleting === item.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeliverableRow({
  item,
  onToggle,
  onDelete,
  toggling,
  deleting,
}: {
  item: VideoDeliverable;
  onToggle: (item: VideoDeliverable) => void;
  onDelete: (id: string) => void;
  toggling: boolean;
  deleting: boolean;
}) {
  const isDelivered = item.status === "delivered";
  const platform = detectPlatform(item.url);
  const typeLabel = TYPE_OPTIONS.find((t) => t.value === item.type)?.label ?? item.type;

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
      isDelivered
        ? "border-emerald-500/20 bg-emerald-500/5"
        : "border-border bg-card/50"
    }`}>
      {/* Status toggle */}
      <button
        type="button"
        onClick={() => onToggle(item)}
        disabled={toggling}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        title={isDelivered ? "Move back to draft" : "Mark as delivered"}
      >
        {toggling ? (
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        ) : isDelivered ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${isDelivered ? "text-foreground" : "text-foreground/80"}`}>
            {item.title}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[item.type]}`}>
            {TYPE_ICONS[item.type]}
            {typeLabel}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{platform}</span>
          {item.notes && <><span>·</span><span className="truncate max-w-[200px]">{item.notes}</span></>}
          {isDelivered && item.delivered_at && (
            <><span>·</span><span className="text-emerald-400/70">Delivered {new Date(item.delivered_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          title="Open link"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          disabled={deleting}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          title="Delete"
        >
          {deleting ? (
            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
