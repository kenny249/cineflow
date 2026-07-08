"use client";

import { useState } from "react";
import { X, Copy, Check, Send, Trash2, Eye, Plus, RotateCcw, Mail } from "lucide-react";
import { toast } from "sonner";
import { updateReviewToken, revokeReviewToken, regenerateReviewToken } from "@/lib/supabase/queries";
import type { ReviewToken } from "@/types";

interface Props {
  token: ReviewToken;
  projectTitle?: string;
  onUpdated?: (t: ReviewToken) => void;
  onRevoked?: () => void;
  onClose: () => void;
}

function normalize(emails: string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/**
 * The single, canonical client-portal manager, rendered everywhere the portal
 * surfaces. Access is by link (token) — the email list is only who we notify.
 */
export function ManagePortalModal({ token, projectTitle, onUpdated, onRevoked, onClose }: Props) {
  const [name, setName] = useState(token.client_name ?? "");
  const [emails, setEmails] = useState<string[]>(
    token.client_emails && token.client_emails.length > 0
      ? token.client_emails
      : token.client_email ? [token.client_email] : []
  );
  const [invited, setInvited] = useState<string[]>(token.invited_emails ?? []);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const url = typeof window !== "undefined"
    ? `${window.location.origin}/review/${token.token}`
    : `/review/${token.token}`;

  const originalEmails = token.client_emails && token.client_emails.length > 0
    ? token.client_emails : (token.client_email ? [token.client_email] : []);
  const dirty = name.trim() !== (token.client_name ?? "") ||
    normalize(emails).join(",") !== normalize(originalEmails).join(",");
  const notInvited = emails.filter((e) => !invited.map((x) => x.toLowerCase()).includes(e.toLowerCase()));

  function addEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Enter a valid email"); return; }
    if (emails.map((x) => x.toLowerCase()).includes(e)) { setNewEmail(""); return; }
    setEmails((prev) => [...prev, e]);
    setNewEmail("");
  }

  function removeEmail(e: string) {
    setEmails((prev) => prev.filter((x) => x !== e));
  }

  async function persist(nextEmails: string[], nextInvited?: string[]) {
    const updated = await updateReviewToken(token.id, {
      client_name: name.trim(),
      client_emails: normalize(nextEmails),
      ...(nextInvited ? { invited_emails: normalize(nextInvited) } : {}),
    });
    onUpdated?.(updated);
    return updated;
  }

  async function save() {
    if (!name.trim()) { toast.error("Client name is required"); return; }
    setSaving(true);
    try {
      await persist(emails);
      toast.success("Portal updated — the link is unchanged");
    } catch { toast.error("Failed to update portal"); }
    finally { setSaving(false); }
  }

  async function sendTo(targets: string[]) {
    const clean = normalize(targets);
    if (clean.length === 0) { toast.error("No recipients to send to"); return; }
    setSending(true);
    try {
      // Save any pending list/name changes first so recipients are current.
      if (dirty) await persist(emails);
      await Promise.all(clean.map((e) =>
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "portal_live", clientName: name.trim(), clientEmail: e, projectTitle: projectTitle ?? "", portalUrl: url }),
        })
      ));
      const nextInvited = normalize([...invited, ...clean]);
      setInvited(nextInvited);
      await persist(emails, nextInvited);
      toast.success(clean.length === 1 ? `Invite sent to ${clean[0]}` : `Invite sent to ${clean.length} recipients`);
    } catch { toast.error("Failed to send invite"); }
    finally { setSending(false); }
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      const fresh = await regenerateReviewToken({ ...token, client_name: name.trim(), client_emails: normalize(emails) });
      setInvited([]);
      onUpdated?.(fresh);
      toast.success("New link generated — the old link no longer works");
      setConfirmRegen(false);
    } catch { toast.error("Failed to regenerate link"); }
    finally { setRegenerating(false); }
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

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Client / company name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none" />
          </div>

          {/* Recipients */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Recipients — who we notify</label>
            <div className="space-y-1.5">
              {emails.map((e) => {
                const isInvited = invited.map((x) => x.toLowerCase()).includes(e.toLowerCase());
                return (
                  <div key={e} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5">
                    <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-xs text-foreground">{e}</span>
                    {isInvited
                      ? <span className="flex items-center gap-0.5 text-[10px] text-emerald-400"><Check className="h-2.5 w-2.5" /> invited</span>
                      : <span className="text-[10px] text-amber-400">not sent</span>}
                    <button onClick={() => removeEmail(e)} className="text-muted-foreground/50 hover:text-red-400 transition-colors"><X className="h-3 w-3" /></button>
                  </div>
                );
              })}
              {emails.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic px-1">No recipients yet — add one below.</p>}
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  placeholder="Add teammate@company.com"
                  className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
                <button onClick={addEmail} className="flex items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:text-[#d4a853] hover:border-[#d4a853]/40 transition-colors"><Plus className="h-3 w-3" /> Add</button>
              </div>
            </div>
            {dirty && (
              <button onClick={save} disabled={saving} className="mt-2 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-60 transition-colors">
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>

          {/* Link */}
          <div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">{url}</span>
              <button onClick={copy} className="flex shrink-0 items-center gap-1 rounded-md bg-[#d4a853]/10 px-2 py-1 text-[11px] font-medium text-[#d4a853] hover:bg-[#d4a853]/20 transition-colors">
                {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
              </button>
            </div>
            <p className="mt-1 px-0.5 text-[10px] text-muted-foreground/60">Anyone with this link can view — emails are just who we notify.</p>
          </div>

          {/* Send + preview */}
          <div className="grid grid-cols-2 gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/20 py-2 text-xs font-medium text-muted-foreground hover:border-[#d4a853]/30 hover:text-[#d4a853] transition-colors">
              <Eye className="h-3.5 w-3.5" /> Preview
            </a>
            {notInvited.length > 0 ? (
              <button onClick={() => sendTo(notInvited)} disabled={sending} className="flex items-center justify-center gap-1.5 rounded-lg bg-[#d4a853] py-2 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-60">
                <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : `Send invite (${notInvited.length})`}
              </button>
            ) : (
              <button onClick={() => sendTo(emails)} disabled={sending || emails.length === 0} className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/20 py-2 text-xs font-medium text-muted-foreground hover:border-[#d4a853]/30 hover:text-[#d4a853] transition-colors disabled:opacity-60">
                <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Resend to all"}
              </button>
            )}
          </div>
          {notInvited.length > 0 && emails.length > notInvited.length && (
            <button onClick={() => sendTo(emails)} disabled={sending} className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              …or resend to everyone ({emails.length})
            </button>
          )}

          {/* Danger zone */}
          <div className="border-t border-border pt-3 space-y-2">
            {/* Regenerate = cut access */}
            {confirmRegen ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-muted-foreground">Generate a new link? Anyone with the old link is locked out.</span>
                <button onClick={regenerate} disabled={regenerating} className="rounded-md bg-[#d4a853] px-2.5 py-1 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-60">{regenerating ? "…" : "Regenerate"}</button>
                <button onClick={() => setConfirmRegen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmRegen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#d4a853] transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Regenerate link (locks out the old one)
              </button>
            )}
            {/* Revoke = remove portal */}
            {confirmRevoke ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-muted-foreground">Revoke this portal? It will be removed entirely.</span>
                <button onClick={revoke} disabled={revoking} className="rounded-md bg-red-500/90 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60">{revoking ? "…" : "Revoke"}</button>
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
