"use client";

import { useState, useTransition } from "react";
import {
  Plus, Copy, Trash2, Check, Crown, Link2, Mail, ChevronDown,
  ChevronUp, Eye, EyeOff, Sparkles, Users, Clock, ToggleLeft, ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type InviteLink = {
  id: string;
  code: string;
  plan: string;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  notes: string | null;
  headline: string | null;
  badge_text: string | null;
  subtext: string | null;
  invitee_name: string | null;
  access_type: string;
  trial_days: number;
  is_active: boolean;
  created_at: string;
};

type InviteUse = {
  email: string;
  used_at: string;
};

const ACCESS_TYPES = [
  { value: "founding", label: "Founding Member", desc: "Free forever — no billing ever", icon: Sparkles },
  { value: "trial", label: "Extended Trial", desc: "Custom trial length (you pick the days)", icon: Clock },
  { value: "standard", label: "Standard Trial", desc: "Normal 30-day trial", icon: Users },
];

const PLANS = ["solo", "studio", "agency", "lifetime"];
const PLAN_LABELS: Record<string, string> = { solo: "Solo", studio: "Studio", agency: "Agency", lifetime: "Lifetime" };

export function InviteLinksClient({ links: initial, appUrl }: { links: InviteLink[]; appUrl: string }) {
  const [links, setLinks] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uses, setUses] = useState<Record<string, InviteUse[]>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [sendEmailTarget, setSendEmailTarget] = useState<string | null>(null);
  const [sendEmailAddress, setSendEmailAddress] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const blank = {
    plan: "studio", access_type: "founding", max_uses: "1", trial_days: "30",
    notes: "", headline: "", badge_text: "Founding Member", subtext: "Exclusive access. Free forever. No credit card.",
    invitee_name: "", expires_at: "",
  };
  const [form, setForm] = useState(blank);
  const setF = (k: keyof typeof blank, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${appUrl}/invite/${code}`);
    setCopied(code);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(null), 2000);
  }

  function copyTextMsg(link: InviteLink) {
    const firstName = link.invitee_name?.split(" ")[0];
    const url = `${appUrl}/invite/${link.code}`;
    const msg = firstName
      ? `Hey ${firstName}, I saved you a spot on CineFlow — ${url}`
      : `Hey, I saved you a spot on CineFlow — ${url}`;
    navigator.clipboard.writeText(msg);
    toast.success("Text message copied!");
  }

  function openForm(link?: InviteLink) {
    if (link) {
      setEditingId(link.id);
      setForm({
        plan: link.plan,
        access_type: link.access_type,
        max_uses: link.max_uses?.toString() ?? "",
        trial_days: link.trial_days?.toString() ?? "30",
        notes: link.notes ?? "",
        headline: link.headline ?? "",
        badge_text: link.badge_text ?? "Founding Member",
        subtext: link.subtext ?? "",
        invitee_name: link.invitee_name ?? "",
        expires_at: link.expires_at ? link.expires_at.split("T")[0] : "",
      });
    } else {
      setEditingId(null);
      setForm(blank);
    }
    setShowForm(true);
  }

  function save() {
    startTransition(async () => {
      const body = {
        plan: form.plan,
        access_type: form.access_type,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        trial_days: parseInt(form.trial_days) || 30,
        notes: form.notes.trim() || null,
        headline: form.headline.trim() || null,
        badge_text: form.badge_text.trim() || "Founding Member",
        subtext: form.subtext.trim() || null,
        invitee_name: form.invitee_name.trim() || null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };

      if (editingId) {
        const res = await fetch("/api/admin/invite-links", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...body }),
        });
        if (res.ok) {
          const json = await res.json();
          setLinks(links.map((l) => (l.id === editingId ? { ...l, ...json.link } : l)));
          toast.success("Invite link updated");
          setShowForm(false);
        } else {
          toast.error("Failed to update link");
        }
      } else {
        const res = await fetch("/api/admin/invite-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (res.ok) {
          setLinks([json.link, ...links]);
          toast.success("Invite link created");
          setShowForm(false);
        } else {
          toast.error("Failed to create link");
        }
      }
    });
  }

  async function toggleActive(link: InviteLink) {
    const res = await fetch("/api/admin/invite-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: link.id, is_active: !link.is_active }),
    });
    if (res.ok) {
      setLinks(links.map((l) => l.id === link.id ? { ...l, is_active: !l.is_active } : l));
      toast.success(link.is_active ? "Link paused" : "Link activated");
    }
  }

  function deleteLink(id: string) {
    if (!confirm("Delete this invite link permanently?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/invite-links?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setLinks(links.filter((l) => l.id !== id));
        toast.success("Link deleted");
      } else {
        toast.error("Failed to delete");
      }
    });
  }

  async function loadUses(linkId: string) {
    if (uses[linkId]) {
      setExpandedId(expandedId === linkId ? null : linkId);
      return;
    }
    const res = await fetch(`/api/admin/invite-links/uses?id=${linkId}`);
    if (res.ok) {
      const json = await res.json();
      setUses((u) => ({ ...u, [linkId]: json.uses }));
      setExpandedId(linkId);
    }
  }

  async function sendEmail(link: InviteLink) {
    if (!sendEmailAddress.trim()) {
      toast.error("Enter an email address first");
      return;
    }
    setIsSending(true);
    const res = await fetch("/api/admin/invite-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send-email",
        to_email: sendEmailAddress.trim(),
        invite_code: link.code,
        invitee_name: link.invitee_name,
        headline: link.headline,
        badge_text: link.badge_text,
        subtext: link.subtext,
        plan: link.plan,
        access_type: link.access_type,
      }),
    });
    setIsSending(false);
    if (res.ok) {
      toast.success(`Invite sent to ${sendEmailAddress}`);
      setSendEmailTarget(null);
      setSendEmailAddress("");
    } else {
      toast.error("Failed to send email");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex justify-end">
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 rounded-xl bg-[#d4a853] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New invite link
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-6">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-bold text-white">{editingId ? "Edit invite link" : "New invite link"}</p>
            <button onClick={() => setShowForm(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
          </div>

          <div className="space-y-5">
            {/* Access type */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Access type</label>
              <div className="grid grid-cols-3 gap-2">
                {ACCESS_TYPES.map(({ value, label, desc, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setF("access_type", value)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                      form.access_type === value
                        ? "border-[#d4a853]/50 bg-[#d4a853]/10"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15]"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", form.access_type === value ? "text-[#d4a853]" : "text-zinc-600")} />
                    <span className={cn("text-xs font-semibold", form.access_type === value ? "text-white" : "text-zinc-400")}>{label}</span>
                    <span className="text-[10px] leading-tight text-zinc-600">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Plan + trial days */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Plan tier</label>
                <select
                  value={form.plan}
                  onChange={(e) => setF("plan", e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white focus:outline-none"
                >
                  {PLANS.map((p) => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
                </select>
              </div>
              {form.access_type === "trial" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Trial days</label>
                  <input
                    type="text" inputMode="numeric"
                    value={form.trial_days}
                    onChange={(e) => setF("trial_days", e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Max uses (blank = unlimited)</label>
                <input
                  type="text" inputMode="numeric"
                  value={form.max_uses}
                  onChange={(e) => setF("max_uses", e.target.value.replace(/\D/g, ""))}
                  placeholder="Unlimited"
                  className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Expires (optional)</label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setF("expires_at", e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Invite page customization */}
            <div className="border-t border-white/[0.06] pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Invite page — what they see</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Invitee name (personalizes the page)</label>
                  <input
                    type="text"
                    value={form.invitee_name}
                    onChange={(e) => setF("invitee_name", e.target.value)}
                    placeholder="e.g. Marcus Reid"
                    className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Badge text</label>
                  <input
                    type="text"
                    value={form.badge_text}
                    onChange={(e) => setF("badge_text", e.target.value)}
                    placeholder="Founding Member"
                    className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-zinc-500">Headline</label>
                  <input
                    type="text"
                    value={form.headline}
                    onChange={(e) => setF("headline", e.target.value)}
                    placeholder="You've been personally invited to CineFlow"
                    className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-zinc-500">Subtext</label>
                  <input
                    type="text"
                    value={form.subtext}
                    onChange={(e) => setF("subtext", e.target.value)}
                    placeholder="Exclusive access. Free forever. No credit card."
                    className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-zinc-500">Internal notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setF("notes", e.target.value)}
                    placeholder="e.g. YouTube influencer batch — May 2026"
                    className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={save}
                disabled={isPending}
                className="rounded-xl bg-[#d4a853] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
              >
                {isPending ? "Saving…" : editingId ? "Save changes" : "Create link"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Links table */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {links.length === 0 ? (
          <div className="py-20 text-center">
            <Link2 className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-600">No invite links yet. Create one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {links.map((link) => {
              const url = `${appUrl}/invite/${link.code}`;
              const exhausted = link.max_uses !== null && link.uses >= link.max_uses;
              const isExpanded = expandedId === link.id;
              const isSendTarget = sendEmailTarget === link.id;

              return (
                <div key={link.id}>
                  <div className={cn("p-4", !link.is_active && "opacity-50")}>
                    <div className="flex items-start gap-4">
                      {/* Left: link info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {/* Access type badge */}
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            link.access_type === "founding"
                              ? "bg-[#d4a853]/15 border border-[#d4a853]/30 text-[#d4a853]"
                              : "bg-white/[0.05] border border-white/[0.08] text-zinc-400"
                          )}>
                            {link.access_type === "founding" && <Crown className="h-2.5 w-2.5" />}
                            {link.access_type === "founding" ? "Founding" : link.access_type === "trial" ? `${link.trial_days}d trial` : "Standard"}
                          </span>

                          {/* Plan */}
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                            {PLAN_LABELS[link.plan] ?? link.plan}
                          </span>

                          {/* Active/paused */}
                          {!link.is_active && (
                            <span className="text-[10px] text-red-400 font-semibold">PAUSED</span>
                          )}
                        </div>

                        {/* Invitee name / notes */}
                        {(link.invitee_name || link.notes) && (
                          <p className="text-sm text-white font-medium mb-1">
                            {link.invitee_name ?? link.notes}
                          </p>
                        )}
                        {link.invitee_name && link.notes && (
                          <p className="text-xs text-zinc-600 mb-1">{link.notes}</p>
                        )}

                        {/* URL */}
                        <div className="flex items-center gap-2 mt-1">
                          <code className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-400 font-mono truncate max-w-[200px]">
                            /invite/{link.code}
                          </code>
                          <button onClick={() => copyLink(link.code)} className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
                            {copied === link.code ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Center: stats */}
                      <div className="text-center shrink-0">
                        <p className={cn("text-lg font-bold", exhausted ? "text-red-400" : "text-white")}>
                          {link.uses}
                          {link.max_uses !== null && <span className="text-sm text-zinc-600"> / {link.max_uses}</span>}
                        </p>
                        <p className="text-[10px] text-zinc-600">uses</p>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Send email */}
                        <button
                          onClick={() => { setSendEmailTarget(isSendTarget ? null : link.id); setSendEmailAddress(""); }}
                          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-zinc-400 hover:border-[#d4a853]/30 hover:text-[#d4a853] transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Email
                        </button>

                        {/* Copy text msg */}
                        <button
                          onClick={() => copyTextMsg(link)}
                          title="Copy text message"
                          className="rounded-lg border border-white/[0.08] p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>

                        {/* Who used it */}
                        <button
                          onClick={() => loadUses(link.id)}
                          title="See who used this"
                          className="rounded-lg border border-white/[0.08] p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => openForm(link)}
                          className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-white transition-colors"
                        >
                          Edit
                        </button>

                        {/* Toggle active */}
                        <button onClick={() => toggleActive(link)} title={link.is_active ? "Pause link" : "Activate link"} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                          {link.is_active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>

                        {/* Delete */}
                        <button onClick={() => deleteLink(link.id)} className="text-zinc-700 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Send email inline form */}
                    {isSendTarget && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-3">
                        <Mail className="h-4 w-4 text-[#d4a853] shrink-0" />
                        <input
                          type="email"
                          value={sendEmailAddress}
                          onChange={(e) => setSendEmailAddress(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendEmail(link)}
                          placeholder="recipient@email.com"
                          autoFocus
                          className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                        />
                        <button
                          onClick={() => sendEmail(link)}
                          disabled={isSending}
                          className="rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
                        >
                          {isSending ? "Sending…" : "Send"}
                        </button>
                        <button onClick={() => setSendEmailTarget(null)} className="text-zinc-600 hover:text-zinc-400">
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Who used it */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] bg-black/20 px-4 py-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
                        {uses[link.id]?.length ?? 0} signups via this link
                      </p>
                      {!uses[link.id] || uses[link.id].length === 0 ? (
                        <p className="text-xs text-zinc-600">No one has used this link yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {uses[link.id].map((u) => (
                            <div key={u.email + u.used_at} className="flex items-center justify-between">
                              <span className="text-xs text-zinc-300">{u.email}</span>
                              <span className="text-xs text-zinc-600">
                                {new Date(u.used_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
