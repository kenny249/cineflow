"use client";

import { useState, useTransition } from "react";
import { Search, Shield, ShieldCheck, ShieldOff, MoreHorizontal, Check, Trash2, Crown, Clock, AlertCircle, CheckCircle2, Star, Download, Mail, LogIn, StickyNote, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type User = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  plan: string;
  plan_status: string;
  trial_ends_at: string | null;
  is_admin: boolean;
  referral_code: string | null;
  referred_by: string | null;
  invoices: number;
  projects: number;
  created_at: string;
  last_sign_in: string | null;
};

const PLAN_COLORS: Record<string, string> = {
  lifetime:     "bg-[#d4a853]/15 text-[#d4a853] border-[#d4a853]/30",
  enterprise:   "bg-orange-500/10 text-orange-400 border-orange-500/20",
  agency:       "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  studio:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  studio_beta:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  solo:         "bg-purple-500/10 text-purple-400 border-purple-500/20",
  solo_beta:    "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const PLAN_LABELS: Record<string, string> = {
  solo:         "Solo",
  studio:       "Studio",
  agency:       "Agency",
  enterprise:   "Enterprise",
  lifetime:     "Lifetime",
  solo_beta:    "Solo (Beta)",
  studio_beta:  "Studio (Beta)",
};

const PLANS = ["solo", "studio", "agency", "enterprise", "lifetime", "solo_beta", "studio_beta"];

function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function trialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function TrialBadge({ plan, planStatus, trialEndsAt }: { plan: string; planStatus: string; trialEndsAt: string | null }) {
  if (plan === "lifetime") return null; // plan badge already communicates this
  if (planStatus === "founding") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#d4a853]/30 bg-[#d4a853]/10 px-2 py-0.5 text-[10px] font-medium text-[#d4a853]">
        <Star className="h-2.5 w-2.5" /> Founding
      </span>
    );
  }
  if (planStatus === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
        <CheckCircle2 className="h-2.5 w-2.5" /> Active
      </span>
    );
  }
  if (planStatus === "trialing") {
    const days = trialDaysLeft(trialEndsAt);
    if (days <= 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
          <AlertCircle className="h-2.5 w-2.5" /> Expired
        </span>
      );
    }
    const color = days <= 5 ? "text-amber-400 border-amber-500/20 bg-amber-500/10" : "text-zinc-400 border-zinc-700 bg-white/[0.03]";
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}>
        <Clock className="h-2.5 w-2.5" /> {days}d left
      </span>
    );
  }
  return null;
}

export function UsersTable({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [emailModal, setEmailModal] = useState<{ userId: string; email: string; name: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [impersonateModal, setImpersonateModal] = useState<{ link: string; email: string } | null>(null);
  const [customDays, setCustomDays] = useState<Record<string, string>>({});
  const [notesModal, setNotesModal] = useState<{ userId: string; name: string } | null>(null);
  const [notesList, setNotesList] = useState<{ id: string; body: string; created_at: string; author_name: string }[]>([]);
  const [newNote, setNewNote] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);

  function exportCSV() {
    const rows = [
      ["Name", "Email", "Company", "Plan", "Status", "Trial Ends", "Projects", "Invoices", "Joined", "Last Seen"],
      ...filtered.map((u) => [
        u.name ?? "",
        u.email,
        u.company ?? "",
        PLAN_LABELS[u.plan] ?? u.plan,
        u.plan_status,
        u.trial_ends_at ? new Date(u.trial_ends_at).toLocaleDateString() : "",
        u.projects,
        u.invoices,
        new Date(u.created_at).toLocaleDateString(),
        u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString() : "Never",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cineflow-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendEmail() {
    if (!emailModal || !emailSubject.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    const res = await fetch("/api/admin/email-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: emailModal.userId, subject: emailSubject, message: emailBody }),
    });
    setEmailSending(false);
    if (res.ok) {
      toast.success(`Email sent to ${emailModal.email}`);
      setEmailModal(null);
      setEmailSubject("");
      setEmailBody("");
    } else {
      const j = await res.json();
      toast.error(j.error ?? "Failed to send email");
    }
  }

  async function impersonateUser(userId: string, email: string) {
    startTransition(async () => {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (res.ok && json.link) {
        setImpersonateModal({ link: json.link, email });
        setOpenMenu(null);
      } else {
        toast.error(json.error ?? "Failed to generate login link");
      }
    });
  }

  async function openNotesModal(userId: string, name: string) {
    setNotesModal({ userId, name });
    setNotesList([]);
    setNewNote("");
    setNotesLoading(true);
    setOpenMenu(null);
    const res = await fetch(`/api/admin/notes?userId=${userId}`);
    const json = await res.json();
    setNotesLoading(false);
    if (res.ok) setNotesList(json.notes ?? []);
  }

  async function addNote() {
    if (!notesModal || !newNote.trim()) return;
    const res = await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: notesModal.userId, body: newNote.trim() }),
    });
    const json = await res.json();
    if (res.ok && json.note) {
      setNotesList((prev) => [{ ...json.note, author_name: "You" }, ...prev]);
      setNewNote("");
    } else {
      toast.error(json.error ?? "Failed to add note");
    }
  }

  async function deleteNote(noteId: string) {
    const res = await fetch(`/api/admin/notes?id=${noteId}`, { method: "DELETE" });
    if (res.ok) {
      setNotesList((prev) => prev.filter((n) => n.id !== noteId));
    } else {
      toast.error("Failed to delete note");
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.name?.toLowerCase() ?? "").includes(q) ||
      (u.company?.toLowerCase() ?? "").includes(q);
    const matchesPlan = planFilter === "all" || u.plan === planFilter;
    const matchesStatus = statusFilter === "all" || (() => {
      if (statusFilter === "expired") return u.plan_status === "trialing" && trialDaysLeft(u.trial_ends_at) === 0;
      if (statusFilter === "trialing") return u.plan_status === "trialing" && trialDaysLeft(u.trial_ends_at) > 0;
      return u.plan_status === statusFilter;
    })();
    return matchesSearch && matchesPlan && matchesStatus;
  });

  async function changePlan(userId: string, plan: string) {
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, updates: { plan } }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Plan updated to ${PLAN_LABELS[plan] ?? plan}`);
        if (plan === "lifetime") {
          if (json.email?.sent) {
            toast.success(`Lifetime gift email sent to ${json.email.to}`);
          } else {
            toast.error(`Lifetime email failed: ${json.email?.error ?? "unknown error"}`);
          }
        }
        setOpenMenu(null);
        window.location.reload();
      } else {
        toast.error("Failed to update plan");
      }
    });
  }

  async function extendTrial(userId: string, days: number) {
    startTransition(async () => {
      const newTrialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, updates: { plan_status: "trialing", trial_ends_at: newTrialEnd } }),
      });
      if (res.ok) {
        toast.success(`Trial set to ${days} days from now`);
        setOpenMenu(null);
        window.location.reload();
      } else {
        toast.error("Failed to extend trial");
      }
    });
  }

  async function makeIndefinite(userId: string) {
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, updates: { plan_status: "active", trial_ends_at: null } }),
      });
      if (res.ok) {
        toast.success("Access set to indefinite");
        setOpenMenu(null);
        window.location.reload();
      } else {
        toast.error("Failed to update access");
      }
    });
  }

  async function toggleAdmin(userId: string, grant: boolean) {
    const label = grant ? "grant admin access to" : "revoke admin access from";
    if (!confirm(`Are you sure you want to ${label} this user?`)) return;
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, updates: { is_admin: grant } }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(grant ? "Admin access granted" : "Admin access revoked");
        setOpenMenu(null);
        window.location.reload();
      } else {
        toast.error(json.error ?? "Failed to update admin status");
      }
    });
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users?userId=${userId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("User deleted");
        window.location.reload();
      } else {
        toast.error("Failed to delete user");
      }
    });
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search by name, email, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/[0.06] bg-black/20 py-2 pl-9 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/40 focus:outline-none"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-lg border border-white/[0.06] bg-black/20 py-2 pl-3 pr-8 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="all">All plans</option>
          {PLANS.map((p) => <option key={p} value={p}>{PLAN_LABELS[p] ?? p}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-white/[0.06] bg-black/20 py-2 pl-3 pr-8 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active (paid)</option>
          <option value="trialing">Trialing</option>
          <option value="expired">Trial expired</option>
          <option value="founding">Founding</option>
        </select>
        <span className="text-xs text-zinc-600">{filtered.length} users</span>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-zinc-400 transition-colors hover:text-white"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {["User", "Plan", "Status", "Activity", "Joined", "Last seen", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]">
                {/* User */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d4a853]/20 bg-[#d4a853]/10">
                      <span className="text-xs font-bold text-[#d4a853]">
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium leading-tight text-white">
                        {u.name ?? <span className="font-normal text-zinc-500">—</span>}
                        {u.is_admin && <Shield className="ml-1 inline h-3 w-3 text-[#d4a853]" />}
                      </p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                      {u.company && <p className="text-xs text-zinc-600">{u.company}</p>}
                    </div>
                  </div>
                </td>

                {/* Plan */}
                <td className="px-4 py-3">
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    PLAN_COLORS[u.plan] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"
                  )}>
                    {u.plan === "lifetime" && <Crown className="mr-1 h-3 w-3" />}
                    {PLAN_LABELS[u.plan] ?? u.plan}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <TrialBadge plan={u.plan} planStatus={u.plan_status} trialEndsAt={u.trial_ends_at} />
                </td>

                {/* Activity */}
                <td className="px-4 py-3 text-zinc-400">
                  <span className="text-xs">{u.projects} projects · {u.invoices} invoices</span>
                  {u.referred_by && (
                    <p className="text-xs text-zinc-600">ref: {u.referred_by}</p>
                  )}
                </td>

                {/* Joined */}
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>

                {/* Last seen */}
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {timeAgo(u.last_sign_in)}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="relative flex justify-end">
                    <button
                      onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                      className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.05] hover:text-zinc-300"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {openMenu === u.id && (
                      <div className="absolute right-0 top-8 z-50 min-w-[200px] rounded-xl border border-white/[0.08] bg-[#141414] p-1 shadow-xl">
                        {/* Change plan */}
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Change plan</p>
                        {PLANS.map((plan) => (
                          <button
                            key={plan}
                            onClick={() => changePlan(u.id, plan)}
                            disabled={isPending}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/[0.05]"
                          >
                            {u.plan === plan && <Check className="h-3.5 w-3.5 text-[#d4a853]" />}
                            <span className={u.plan === plan ? "font-medium text-[#d4a853]" : ""}>{PLAN_LABELS[plan] ?? plan}</span>
                          </button>
                        ))}

                        {/* Set trial */}
                        <div className="my-1 border-t border-white/[0.06]" />
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Set trial access</p>
                        {[30, 60, 90].map((days) => (
                          <button
                            key={days}
                            onClick={() => extendTrial(u.id, days)}
                            disabled={isPending}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/[0.05]"
                          >
                            <Clock className="h-3.5 w-3.5 text-zinc-500" />
                            {days} days from now
                          </button>
                        ))}
                        {/* Custom days */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Custom days"
                            value={customDays[u.id] ?? ""}
                            onChange={(e) => setCustomDays((prev) => ({ ...prev, [u.id]: e.target.value.replace(/[^\d]/g, "") }))}
                            className="h-7 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-[#d4a853]/40 focus:outline-none"
                          />
                          <button
                            disabled={isPending || !customDays[u.id]}
                            onClick={() => { const d = parseInt(customDays[u.id] ?? "0", 10); if (d > 0) extendTrial(u.id, d); }}
                            className="h-7 shrink-0 rounded-md bg-[#d4a853]/20 px-2 text-xs font-medium text-[#d4a853] transition-colors hover:bg-[#d4a853]/30 disabled:opacity-40"
                          >
                            Set
                          </button>
                        </div>
                        {/* Indefinite */}
                        <button
                          onClick={() => makeIndefinite(u.id)}
                          disabled={isPending}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/10"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Indefinite access
                        </button>

                        {/* Support actions */}
                        <div className="my-1 border-t border-white/[0.06]" />
                        <button
                          onClick={() => { setEmailModal({ userId: u.id, email: u.email, name: u.name ?? u.email }); setOpenMenu(null); }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-400 transition-colors hover:bg-blue-500/10"
                        >
                          <Mail className="h-3.5 w-3.5" /> Email user
                        </button>
                        <button
                          onClick={() => openNotesModal(u.id, u.name ?? u.email)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/[0.05]"
                        >
                          <StickyNote className="h-3.5 w-3.5" /> Notes
                        </button>
                        <button
                          onClick={() => impersonateUser(u.id, u.email)}
                          disabled={isPending || u.id === currentUserId}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/[0.05] disabled:opacity-40"
                        >
                          <LogIn className="h-3.5 w-3.5" /> Login as user
                        </button>

                        {/* Admin */}
                        <div className="my-1 border-t border-white/[0.06]" />
                        {u.is_admin ? (
                          <button
                            onClick={() => toggleAdmin(u.id, false)}
                            disabled={isPending || u.id === currentUserId}
                            title={u.id === currentUserId ? "Cannot revoke your own access" : undefined}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-40"
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                            Revoke admin
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleAdmin(u.id, true)}
                            disabled={isPending}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-violet-400 transition-colors hover:bg-violet-500/10 disabled:opacity-40"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Grant admin
          </button>
                        )}

                        {/* Delete */}
                        <div className="my-1 border-t border-white/[0.06]" />
                        <button
                          onClick={() => deleteUser(u.id, u.email)}
                          disabled={isPending || u.is_admin}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete user
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-600">
                  No users match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Email user modal ── */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setEmailModal(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-bold text-white">Email {emailModal.name}</h3>
            <p className="mb-4 text-xs text-zinc-500">{emailModal.email}</p>
            <input
              type="text"
              placeholder="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="mb-3 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#d4a853]/40"
            />
            <textarea
              placeholder="Message…"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={5}
              className="mb-4 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#d4a853]/40 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setEmailModal(null)} className="flex-1 rounded-lg border border-white/[0.08] py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={sendEmail} disabled={emailSending || !emailSubject.trim() || !emailBody.trim()} className="flex-1 rounded-lg bg-[#d4a853] py-2 text-sm font-bold text-black transition-all hover:bg-[#e0b55e] disabled:opacity-50">
                {emailSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notes modal ── */}
      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setNotesModal(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Notes · {notesModal.name}</h3>
              <button onClick={() => setNotesModal(null)} className="text-zinc-600 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-4 flex gap-2">
              <textarea
                placeholder="Add a note…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#d4a853]/40 resize-none"
              />
              <button
                onClick={addNote}
                disabled={!newNote.trim()}
                className="rounded-lg bg-[#d4a853] px-4 text-sm font-bold text-black transition-all hover:bg-[#e0b55e] disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {notesLoading ? (
                <p className="text-center text-sm text-zinc-600">Loading…</p>
              ) : notesList.length === 0 ? (
                <p className="text-center text-sm text-zinc-600">No notes yet.</p>
              ) : notesList.map((note) => (
                <div key={note.id} className="group flex items-start justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                  <div className="flex-1">
                    <p className="text-sm text-zinc-300 leading-relaxed">{note.body}</p>
                    <p className="mt-1 text-[11px] text-zinc-600">{note.author_name} · {new Date(note.created_at).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="mt-0.5 shrink-0 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Impersonate modal ── */}
      {impersonateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setImpersonateModal(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-bold text-white">Login as {impersonateModal.email}</h3>
            <p className="mb-4 text-xs text-zinc-500 leading-relaxed">Open this link in an <strong className="text-white">incognito / private window</strong> so you don&apos;t get logged out of your admin account.</p>
            <div className="mb-4 rounded-lg border border-white/[0.06] bg-black/30 p-3">
              <p className="break-all text-[11px] font-mono text-zinc-400">{impersonateModal.link}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setImpersonateModal(null)} className="flex-1 rounded-lg border border-white/[0.08] py-2 text-sm text-zinc-400 hover:text-white transition-colors">Close</button>
              <button
                onClick={() => { navigator.clipboard.writeText(impersonateModal.link); toast.success("Link copied"); }}
                className="flex-1 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/10 py-2 text-sm font-semibold text-[#d4a853] transition-all hover:bg-[#d4a853]/20"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
