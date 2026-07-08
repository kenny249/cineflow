"use client";

import { useState } from "react";
import { X, Copy, Check, Send, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { updateReviewToken, revokeReviewToken } from "@/lib/supabase/queries";
import type { ReviewToken } from "@/types";

interface Props {
  token: ReviewToken;
  projectTitle?: string;
  onUpdated?: (t: ReviewToken) => void;
  onRevoked?: () => void;
  onClose: () => void;
}

/**
 * The single, canonical client-portal manager. Rendered from every place the
 * portal surfaces (project Overview + Review tabs, Review Hub, Clients) so the
 * controls are identical everywhere.
 */
export function ManagePortalModal({ token, projectTitle, onUpdated, onRevoked, onClose }: Props) {
  const [name, setName] = useState(token.client_name ?? "");
  const [email, setEmail] = useState(token.client_email ?? "");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const url = typeof window !== "undefined"
    ? `${window.location.origin}/review/${token.token}`
    : `/review/${token.token}`;
  const dirty = name.trim() !== (token.client_name ?? "") || email.trim() !== (token.client_email ?? "");

  async function save() {
    if (!name.trim() || !email.trim()) { toast.error("Client name and email are required"); return; }
    setSaving(true);
    try {
      const updated = await updateReviewToken(token.id, { client_name: name.trim(), client_email: email.trim() });
      onUpdated?.(updated);
      toast.success("Portal updated — the link is unchanged");
    } catch { toast.error("Failed to update portal"); }
    finally { setSaving(false); }
  }

  async function resend() {
    if (!email.trim()) { toast.error("Add a client email first"); return; }
    setResending(true);
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "portal_live", clientName: name.trim(), clientEmail: email.trim(), projectTitle: projectTitle ?? "", portalUrl: url }),
      });
      toast.success(`Invite sent to ${email.trim()}`);
    } catch { toast.error("Failed to send invite"); }
    finally { setResending(false); }
  }

  async function revoke() {
    setRevoking(true);
    try {
      await revokeReviewToken(token.id);
      onRevoked?.();
      toast.success("Portal revoked — the link no longer works");
      onClose();
    } catch { toast.error("Failed to revoke portal"); setRevoking(false); }
  }

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-sm font-semibold">Manage Client Portal</h2>
            {projectTitle && <p className="text-[11px] text-muted-foreground mt-0.5">{projectTitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Portal active
            </span>
            <span className="text-[10px] text-muted-foreground">
              {token.last_viewed_at ? `Last viewed ${new Date(token.last_viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Not yet viewed"}
            </span>
          </div>

          {/* Name + email */}
          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Client name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Client email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
            {dirty && (
              <button onClick={save} disabled={saving} className="rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-60 transition-colors">
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>

          {/* Link */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">{url}</span>
            <button onClick={copy} className="flex shrink-0 items-center gap-1 rounded-md bg-[#d4a853]/10 px-2 py-1 text-[11px] font-medium text-[#d4a853] hover:bg-[#d4a853]/20 transition-colors">
              {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
            </button>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/20 py-2 text-xs font-medium text-muted-foreground hover:border-[#d4a853]/30 hover:text-[#d4a853] transition-colors">
              <Eye className="h-3.5 w-3.5" /> Preview
            </a>
            <button onClick={resend} disabled={resending} className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/20 py-2 text-xs font-medium text-muted-foreground hover:border-[#d4a853]/30 hover:text-[#d4a853] transition-colors disabled:opacity-60">
              <Send className="h-3.5 w-3.5" /> {resending ? "Sending…" : "Resend invite"}
            </button>
          </div>

          {/* Revoke */}
          <div className="border-t border-border pt-3">
            {confirmRevoke ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-muted-foreground">Revoke this portal? The link will stop working.</span>
                <button onClick={revoke} disabled={revoking} className="rounded-md bg-red-500/90 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60 transition-colors">{revoking ? "…" : "Revoke"}</button>
                <button onClick={() => setConfirmRevoke(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmRevoke(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Revoke portal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
