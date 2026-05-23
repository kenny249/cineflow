"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, Trash2, Send, Users, X, Settings2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { ProjectCollaborator, ProjectMessage, TeamMember } from "@/types";

interface PeopleTabProps {
  projectId: string;
  userId: string;
  displayName: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-xs";
  return (
    <div className={`shrink-0 flex items-center justify-center rounded-full bg-white/5 font-semibold text-white/50 ${s}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const PERMISSION_OPTS = [
  { id: "mark_shots", label: "Mark shots done" },
  { id: "add_notes",  label: "Add notes" },
  { id: "manage_tasks", label: "Manage tasks" },
] as const;

const PERM_CHIP: Record<string, string> = {
  mark_shots:   "shots",
  add_notes:    "notes",
  manage_tasks: "tasks",
};

function PermissionChips({ permissions }: { permissions: string[] }) {
  if (permissions.length === 0) return <span className="text-[9px] text-muted-foreground/40 italic">read only</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {permissions.map((p) => (
        <span key={p} className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-[#d4a853]/10 text-[#d4a853]">
          {PERM_CHIP[p] ?? p}
        </span>
      ))}
    </div>
  );
}

export function PeopleTab({ projectId, userId, displayName }: PeopleTabProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePerms, setInvitePerms] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingPermsId, setEditingPermsId] = useState<string | null>(null);
  const [editPermsVal, setEditPermsVal] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const msgsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("team_members").select("*").order("invited_at", { ascending: true }),
      fetch(`/api/projects/${projectId}/collaborators`).then((r) => r.json()),
    ]).then(([teamRes, collabData]) => {
      setTeamMembers((teamRes.data as TeamMember[]) ?? []);
      setCollaborators(Array.isArray(collabData) ? collabData : []);
      setLoadingPeople(false);
    }).catch(() => setLoadingPeople(false));
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/messages`)
      .then((r) => r.json())
      .then((data) => { setMessages(Array.isArray(data) ? data : []); setLoadingMsgs(false); })
      .catch(() => setLoadingMsgs(false));
  }, [projectId]);

  useEffect(() => {
    const el = msgsContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`people_tab_msgs:${projectId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "project_messages",
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as ProjectMessage];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  function toggleInvitePerm(id: string) {
    setInvitePerms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();
    if (!email || !name) return;
    setInviting(true);

    const res = await fetch(`/api/projects/${projectId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, permissions: invitePerms }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to send invite");
    } else {
      toast.success(`Invite sent to ${email}`);
      setCollaborators((prev) => [...prev, data]);
      setInviteEmail("");
      setInviteName("");
      setInvitePerms([]);
      setShowInviteForm(false);
    }
    setInviting(false);
  }

  async function handleRemove(collab: ProjectCollaborator) {
    setRemovingId(collab.id);
    const res = await fetch(`/api/projects/${projectId}/collaborators?collaboratorId=${collab.id}`, { method: "DELETE" });
    if (res.ok) {
      setCollaborators((prev) => prev.filter((c) => c.id !== collab.id));
      toast.success(`${collab.name} removed`);
    } else {
      toast.error("Failed to remove");
    }
    setRemovingId(null);
  }

  function startEditPerms(collab: ProjectCollaborator) {
    setEditingPermsId(collab.id);
    setEditPermsVal(collab.permissions ?? []);
  }

  function toggleEditPerm(id: string) {
    setEditPermsVal((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  async function savePerms(collabId: string) {
    setSavingPerms(true);
    const res = await fetch(`/api/projects/${projectId}/collaborators`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId: collabId, permissions: editPermsVal }),
    });
    if (res.ok) {
      setCollaborators((prev) => prev.map((c) => c.id === collabId ? { ...c, permissions: editPermsVal } : c));
      toast.success("Permissions updated");
      setEditingPermsId(null);
    } else {
      toast.error("Failed to update permissions");
    }
    setSavingPerms(false);
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    const res = await fetch(`/api/projects/${projectId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, author_name: displayName || "Team Member" }),
    });
    if (!res.ok) setInput(content);
    setSending(false);
    inputRef.current?.focus();
  }

  const grouped: { date: string; msgs: ProjectMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else grouped.push({ date, msgs: [msg] });
  }

  const activeCollabs = collaborators.filter((c) => c.status === "active");
  const pendingCollabs = collaborators.filter((c) => c.status === "pending");

  return (
    <div className="flex h-full min-h-0">

      {/* ── Left sidebar: People ── */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border overflow-y-auto">

        {/* Agency Team */}
        <div className="px-4 pt-5 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Agency Team</p>
          {loadingPeople ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No team members yet.</p>
          ) : (
            <div className="space-y-1.5">
              {teamMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <Avatar name={m.name || m.email} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{m.name || m.email.split("@")[0]}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{m.role}</p>
                  </div>
                  {m.status === "active"
                    ? <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    : <div className="h-1.5 w-1.5 rounded-full bg-amber-400/60 shrink-0" />
                  }
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mx-4 border-t border-border" />

        {/* External Contributors */}
        <div className="px-4 pt-3 pb-4 flex-1">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">External</p>
            <button
              onClick={() => { setShowInviteForm((v) => !v); setInvitePerms([]); }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[#d4a853] hover:bg-[#d4a853]/10 transition-colors"
            >
              {showInviteForm ? <X className="h-2.5 w-2.5" /> : <UserPlus className="h-2.5 w-2.5" />}
              {showInviteForm ? "Cancel" : "Invite"}
            </button>
          </div>

          {/* Invite form */}
          {showInviteForm && (
            <form onSubmit={handleInvite} className="mb-3 space-y-2">
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full name"
                required
                className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#d4a853]/50"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#d4a853]/50"
              />

              {/* Permissions */}
              <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 space-y-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Permissions</p>
                {PERMISSION_OPTS.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => toggleInvitePerm(opt.id)}
                      className={`h-3.5 w-3.5 shrink-0 rounded border transition-colors flex items-center justify-center ${
                        invitePerms.includes(opt.id)
                          ? "border-[#d4a853] bg-[#d4a853]"
                          : "border-border bg-transparent"
                      }`}
                    >
                      {invitePerms.includes(opt.id) && <Check className="h-2 w-2 text-black" />}
                    </div>
                    <span
                      onClick={() => toggleInvitePerm(opt.id)}
                      className="text-[10px] text-muted-foreground select-none"
                    >
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {inviting ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Send className="h-3 w-3" />}
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </form>
          )}

          {loadingPeople ? null : collaborators.length === 0 && !showInviteForm ? (
            <p className="text-xs text-muted-foreground italic">No external contributors yet.</p>
          ) : (
            <div className="space-y-2">
              {activeCollabs.map((c) => (
                <div key={c.id} className="rounded-lg border border-border/50 bg-muted/20 p-2">
                  {editingPermsId === c.id ? (
                    // Inline permission editor
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                        <button
                          onClick={() => setEditingPermsId(null)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {PERMISSION_OPTS.map((opt) => (
                          <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                            <div
                              onClick={() => toggleEditPerm(opt.id)}
                              className={`h-3.5 w-3.5 shrink-0 rounded border transition-colors flex items-center justify-center ${
                                editPermsVal.includes(opt.id)
                                  ? "border-[#d4a853] bg-[#d4a853]"
                                  : "border-border bg-transparent"
                              }`}
                            >
                              {editPermsVal.includes(opt.id) && <Check className="h-2 w-2 text-black" />}
                            </div>
                            <span
                              onClick={() => toggleEditPerm(opt.id)}
                              className="text-[10px] text-muted-foreground select-none"
                            >
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={() => savePerms(c.id)}
                        disabled={savingPerms}
                        className="w-full flex items-center justify-center gap-1 rounded-md bg-[#d4a853]/15 px-2 py-1 text-[10px] font-semibold text-[#d4a853] hover:bg-[#d4a853]/25 transition-colors disabled:opacity-40"
                      >
                        {savingPerms
                          ? <span className="h-2.5 w-2.5 animate-spin rounded-full border border-[#d4a853]/40 border-t-[#d4a853]" />
                          : <Check className="h-2.5 w-2.5" />
                        }
                        Save
                      </button>
                    </div>
                  ) : (
                    // Normal view
                    <div>
                      <div className="flex items-center gap-2">
                        <Avatar name={c.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <button
                            onClick={() => startEditPerms(c)}
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit permissions"
                          >
                            <Settings2 className="h-2.5 w-2.5" />
                          </button>
                          <button
                            onClick={() => handleRemove(c)}
                            disabled={removingId === c.id}
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            {removingId === c.id
                              ? <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
                              : <Trash2 className="h-2.5 w-2.5" />
                            }
                          </button>
                        </div>
                      </div>
                      <div className="mt-1.5 ml-8">
                        <PermissionChips permissions={c.permissions ?? []} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {pendingCollabs.map((c) => (
                <div key={c.id} className="group flex items-center gap-2.5 opacity-60 px-1">
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-amber-400 truncate">Invite pending</p>
                  </div>
                  <button
                    onClick={() => handleRemove(c)}
                    disabled={removingId === c.id}
                    className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: Chat ── */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="border-b border-border px-5 py-3 flex items-center gap-2">
          <p className="text-xs font-semibold text-foreground">Project Chat</p>
          <span className="text-[10px] text-muted-foreground">
            {teamMembers.length + activeCollabs.length} {teamMembers.length + activeCollabs.length === 1 ? "person" : "people"} on this project
          </span>
        </div>

        <div ref={msgsContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
          {loadingMsgs ? (
            <div className="flex h-full items-center justify-center">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
              <Users className="h-6 w-6 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No messages yet — kick off the conversation.</p>
            </div>
          ) : (
            grouped.map(({ date, msgs }) => (
              <div key={date}>
                <div className="flex items-center gap-3 py-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] text-muted-foreground">{date}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {msgs.map((msg, i) => {
                  const isMe = msg.author_id === userId;
                  const prevMsg = i > 0 ? msgs[i - 1] : null;
                  const showAuthor = !prevMsg || prevMsg.author_id !== msg.author_id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${showAuthor ? "mt-3" : "mt-0.5"}`}>
                      {showAuthor && (
                        <span className={`mb-1 text-[10px] text-muted-foreground ${isMe ? "mr-1" : "ml-9"}`}>
                          {isMe ? "You" : msg.author_name}
                        </span>
                      )}
                      <div className="flex items-end gap-2">
                        {!isMe && (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                            {msg.author_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className={`max-w-sm rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          isMe
                            ? "bg-[#d4a853] text-black rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-muted-foreground/40 shrink-0">{formatTime(msg.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Message the team…"
              disabled={sending}
              className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#d4a853]/50 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#d4a853] text-black transition-opacity disabled:opacity-30 hover:opacity-90"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
