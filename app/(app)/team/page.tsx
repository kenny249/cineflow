"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  getTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  getTeamTopics,
  createTeamTopic,
  deleteTeamTopic,
  getTeamMessages,
  sendTeamMessage,
  deleteTeamMessage,
} from "@/lib/supabase/queries";
import type { TeamMember, TeamTopic, TeamMessage } from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  Hash,
  Send,
  Plus,
  UserPlus,
  Trash2,
  Check,
  Crown,
  Shield,
  User,
  MoreHorizontal,
  X,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

// ─── Avatar helpers ───────────────────────────────────────────────────────────

function getInitials(name?: string, email?: string) {
  const source = name || email || "?";
  const parts = source.split(/[\s@]/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function MemberAvatar({ member, size = "md" }: { member: TeamMember | { full_name?: string; email?: string; avatar_url?: string }; size?: "sm" | "md" | "lg" }) {
  const m = member as any;
  const name = m.full_name ?? m.name;
  const email = m.email;
  const avatar = m.avatar_url;
  const sizeClass = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  if (avatar)
    return <img src={avatar} alt={name ?? email} className={`${sizeClass} rounded-full object-cover`} />;
  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-[#d4a853]/20 font-bold text-[#d4a853]`}>
      {getInitials(name, email)}
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  owner: { label: "Owner", icon: Crown, color: "text-[#d4a853] bg-[#d4a853]/10" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-400 bg-blue-400/10" },
  member: { label: "Member", icon: User, color: "text-muted-foreground bg-muted/50" },
} as const;

function RoleBadge({ role }: { role: TeamMember["role"] }) {
  const { label, icon: Icon, color } = ROLE_CONFIG[role];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: (m: TeamMember) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("member");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const member = await inviteTeamMember(email.trim(), name.trim(), role);
      onInvited(member);
      toast.success(`Invite sent to ${email}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">Invite Team Member</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@studio.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Johnson"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamMember["role"])}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-60"
            >
              {loading ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── New topic modal ──────────────────────────────────────────────────────────

const EMOJIS = ["💬", "📢", "🎬", "📷", "✏️", "📋", "🎯", "🔥", "💡", "🌟", "🎵", "🛠️"];

function NewTopicModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: TeamTopic) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const topic = await createTeamTopic(name.trim().toLowerCase().replace(/\s+/g, "-"), description.trim(), emoji);
      onCreated(topic);
      toast.success(`#${topic.name} created`);
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create topic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">New Topic</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`rounded-lg p-2 text-lg transition-all ${emoji === e ? "bg-[#d4a853]/20 ring-1 ring-[#d4a853]/50" : "hover:bg-muted/50"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Topic name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. pre-production"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this topic about?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-60"
            >
              {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Plus className="h-3.5 w-3.5" />}
              Create Topic
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────

function ChatBubble({
  msg,
  isOwn,
  prevSameAuthor,
  onDelete,
}: {
  msg: TeamMessage;
  isOwn: boolean;
  prevSameAuthor: boolean;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const time = new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const m = msg.author as any;
  const displayName = m?.full_name ?? m?.email ?? "Unknown";
  const avatar = m?.avatar_url;
  const sizeClass = "h-7 w-7 text-[10px]";
  const initials = getInitials(m?.full_name, m?.email);

  return (
    <div className={`group flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""} ${prevSameAuthor ? "mt-0.5" : "mt-4"}`}>
      <div className={`mt-0.5 shrink-0 ${prevSameAuthor ? "invisible" : ""}`}>
        {avatar ? (
          <img src={avatar} alt={displayName} className={`${sizeClass} rounded-full object-cover`} />
        ) : (
          <div className={`${sizeClass} flex items-center justify-center rounded-full bg-[#d4a853]/20 font-bold text-[#d4a853]`}>
            {initials}
          </div>
        )}
      </div>
      <div className={`max-w-[72%] flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
        {!prevSameAuthor && (
          <div className={`flex items-baseline gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
            <span className="text-[11px] font-semibold text-foreground/80">{displayName}</span>
            <span className="text-[10px] text-muted-foreground/50">{time}</span>
          </div>
        )}
        <div className="relative flex items-center gap-1.5">
          {isOwn && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded p-1 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/50 hover:!text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute bottom-7 right-0 z-20 rounded-xl border border-border bg-card shadow-xl">
                  <button
                    onClick={() => { onDelete(); setMenuOpen(false); }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors w-full whitespace-nowrap"
                  >
                    <Trash2 className="h-3 w-3" /> Delete message
                  </button>
                </div>
              )}
            </div>
          )}
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
              isOwn
                ? "rounded-tr-sm bg-[#d4a853] text-black"
                : "rounded-tl-sm bg-muted/50 text-foreground"
            }`}
          >
            {msg.content}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [topics, setTopics] = useState<TeamTopic[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [activeTopic, setActiveTopic] = useState<TeamTopic | null>(null);
  const [panel, setPanel] = useState<"chat" | "members">("chat");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const memberMenuRef = useRef<HTMLDivElement>(null);

  // ── Init ──
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    getTeamMembers().then(setMembers).catch(() => {});
    getTeamTopics().then((ts) => {
      setTopics(ts);
      if (ts.length > 0) setActiveTopic(ts[0]);
    }).catch(() => {});
  }, []);

  // ── Load messages when topic changes ──
  useEffect(() => {
    if (!activeTopic) return;
    setLoadingMsgs(true);
    setMessages([]);
    getTeamMessages(activeTopic.id)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  }, [activeTopic]);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!activeTopic) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`team_msgs_${activeTopic.id}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "team_messages", filter: `topic_id=eq.${activeTopic.id}` },
        async (payload: any) => {
          const row = payload.new as TeamMessage;
          if (row.author_id === currentUserId) return; // already added optimistically
          if (row.author_id) {
            const { data: p } = await supabase.from("profiles").select("id, full_name, avatar_url, email").eq("id", row.author_id).maybeSingle();
            if (p) (row as any).author = p;
          }
          setMessages((prev) => [...prev, row]);
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "DELETE", schema: "public", table: "team_messages", filter: `topic_id=eq.${activeTopic.id}` },
        (payload: any) => { setMessages((prev) => prev.filter((m) => m.id !== payload.old.id)); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTopic?.id, currentUserId]);

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-resize textarea ──
  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  // ── Close member menu on outside click ──
  useEffect(() => {
    if (!memberMenuId) return;
    const handler = (e: MouseEvent) => {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target as Node)) setMemberMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [memberMenuId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeTopic || sending) return;
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    try {
      const msg = await sendTeamMessage(activeTopic.id, content);
      setMessages((prev) => [...prev, msg]);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send message");
      setDraft(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  async function handleDeleteMessage(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try { await deleteTeamMessage(id); }
    catch { toast.error("Failed to delete message"); }
  }

  async function handleRemoveMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setMemberMenuId(null);
    try { await removeTeamMember(id); toast.success("Member removed"); }
    catch { toast.error("Failed to remove member"); }
  }

  async function handleRoleChange(id: string, role: TeamMember["role"]) {
    setMemberMenuId(null);
    try {
      const updated = await updateTeamMemberRole(id, role);
      setMembers((prev) => prev.map((m) => m.id === id ? updated : m));
      toast.success("Role updated");
    } catch { toast.error("Failed to update role"); }
  }

  async function handleDeleteTopic(id: string) {
    const remaining = topics.filter((t) => t.id !== id);
    setTopics(remaining);
    if (activeTopic?.id === id) setActiveTopic(remaining[0] ?? null);
    try { await deleteTeamTopic(id); }
    catch { toast.error("Failed to delete topic"); }
  }

  const activeCount = members.filter((m) => m.status === "active").length;
  const pendingCount = members.filter((m) => m.status === "pending").length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3.5">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Team</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {members.length === 0 ? "Invite your crew to get started" : `${activeCount} active${pendingCount > 0 ? `, ${pendingCount} pending` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPanel((p) => (p === "chat" ? "members" : "chat"))}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              panel === "members"
                ? "border-[#d4a853]/30 bg-[#d4a853]/10 text-[#d4a853]"
                : "border-border bg-card text-muted-foreground hover:border-[#d4a853]/20 hover:text-foreground"
            }`}
          >
            {panel === "chat" ? <Users className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
            {panel === "chat" ? "Members" : "Chat"}
          </button>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Topics sidebar ── */}
        <div className="flex w-52 shrink-0 flex-col border-r border-border bg-card/20">
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Topics</span>
            <button
              onClick={() => setNewTopicOpen(true)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title="New topic"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 custom-scrollbar">
            {topics.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground/60">No topics yet</p>
            ) : (
              topics.map((topic) => (
                <div key={topic.id} className="group relative">
                  <button
                    onClick={() => { setActiveTopic(topic); setPanel("chat"); }}
                    className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${
                      activeTopic?.id === topic.id
                        ? "bg-[#d4a853]/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                  >
                    <span className="text-sm leading-none">{topic.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{topic.name}</span>
                    {activeTopic?.id === topic.id && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4a853]" />}
                  </button>
                  {topic.name !== "general" && (
                    <button
                      onClick={() => handleDeleteTopic(topic.id)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden rounded p-0.5 text-muted-foreground hover:text-red-400 group-hover:flex transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Members strip */}
          <div className="shrink-0 border-t border-border p-3">
            <button
              onClick={() => setPanel("members")}
              className="mb-2 flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <span>Members</span>
              {members.length > 0 && <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px]">{members.length}</span>}
            </button>
            {members.length === 0 ? (
              <button
                onClick={() => setInviteOpen(true)}
                className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:border-[#d4a853]/30 hover:text-[#d4a853] transition-colors"
              >
                <UserPlus className="h-3 w-3" />
                Invite first member
              </button>
            ) : (
              <div className="flex flex-wrap gap-1">
                {members.slice(0, 10).map((m) => {
                  const initials = getInitials(m.name, m.email);
                  return (
                    <div key={m.id} title={m.name ?? m.email} className={`relative ${m.status !== "active" ? "opacity-50" : ""}`}>
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={m.name ?? m.email} className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="h-7 w-7 flex items-center justify-center rounded-full bg-[#d4a853]/20 text-[10px] font-bold text-[#d4a853]">{initials}</div>
                      )}
                      {m.status === "active" && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-1 ring-card" />}
                    </div>
                  );
                })}
                {members.length > 10 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-[9px] text-muted-foreground">
                    +{members.length - 10}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Chat or Members ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {panel === "chat" ? (
            <>
              {activeTopic && (
                <div className="shrink-0 flex items-center gap-2.5 border-b border-border px-5 py-3">
                  <span className="text-xl leading-none">{activeTopic.emoji}</span>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{activeTopic.name}</h2>
                    {activeTopic.description && <p className="text-[11px] text-muted-foreground">{activeTopic.description}</p>}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                {!activeTopic && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <Hash className="h-10 w-10 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">Select a topic to start chatting</p>
                  </div>
                )}
                {activeTopic && loadingMsgs && (
                  <div className="flex justify-center py-10">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
                  </div>
                )}
                {activeTopic && !loadingMsgs && messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <div className="text-5xl">{activeTopic.emoji}</div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Welcome to #{activeTopic.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{activeTopic.description ?? "Be the first to say something."}</p>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const prev = messages[i - 1];
                  const prevSame = !!prev && prev.author_id === msg.author_id && prev.author_id != null &&
                    new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
                  return (
                    <ChatBubble
                      key={msg.id}
                      msg={msg}
                      isOwn={msg.author_id === currentUserId}
                      prevSameAuthor={prevSame}
                      onDelete={() => handleDeleteMessage(msg.id)}
                    />
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {activeTopic && (
                <form onSubmit={handleSend} className="shrink-0 border-t border-border px-4 py-3.5">
                  <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/20 px-3.5 py-2.5 focus-within:border-[#d4a853]/40 focus-within:ring-1 focus-within:ring-[#d4a853]/20 transition-all">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={draft}
                      onChange={(e) => { setDraft(e.target.value); autoResize(); }}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message #${activeTopic.name}`}
                      className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                      style={{ minHeight: "20px", maxHeight: "120px" }}
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d4a853] text-black transition-all hover:bg-[#c49843] disabled:opacity-40 active:scale-95"
                    >
                      {sending
                        ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                        : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground/50">Enter to send · Shift+Enter for new line</p>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">Team Members</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {members.length === 0 ? "No members yet" : `${members.length} total · ${activeCount} active`}
                  </p>
                </div>
                <button
                  onClick={() => setInviteOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/8 px-3 py-1.5 text-xs font-medium text-[#d4a853] hover:bg-[#d4a853]/15 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite
                </button>
              </div>

              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border">
                    <Users className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Your crew awaits</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">Invite team members to collaborate on projects and chat in real time.</p>
                  </div>
                  <button
                    onClick={() => setInviteOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Invite First Member
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="group relative flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-[#d4a853]/20 hover:shadow-sm">
                      <div className="relative">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.name ?? member.email} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 flex items-center justify-center rounded-full bg-[#d4a853]/20 text-xs font-bold text-[#d4a853]">
                            {getInitials(member.name, member.email)}
                          </div>
                        )}
                        {member.status === "active" && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">{member.name ?? member.email}</span>
                          {member.status === "pending" && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">Invited</span>
                          )}
                        </div>
                        {member.name && <p className="text-xs text-muted-foreground truncate">{member.email}</p>}
                      </div>
                      <RoleBadge role={member.role} />
                      <div className="relative ml-1" ref={memberMenuId === member.id ? memberMenuRef : null}>
                        <button
                          onClick={() => setMemberMenuId(memberMenuId === member.id ? null : member.id)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-muted/50 hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {memberMenuId === member.id && (
                          <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-border bg-card shadow-2xl">
                            <div className="p-1">
                              <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">Change role</p>
                              {(["member", "admin"] as const).map((r) => (
                                <button
                                  key={r}
                                  onClick={() => handleRoleChange(member.id, r)}
                                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted/50 transition-colors"
                                >
                                  <span className="flex items-center gap-1.5">
                                    {React.createElement(ROLE_CONFIG[r].icon, { className: "h-3 w-3" })}
                                    {ROLE_CONFIG[r].label}
                                  </span>
                                  {member.role === r && <Check className="h-3 w-3 text-[#d4a853]" />}
                                </button>
                              ))}
                              <div className="my-1 border-t border-border" />
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" /> Remove from team
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} onInvited={(m) => setMembers((prev) => [...prev, m])} />
      )}
      {newTopicOpen && (
        <NewTopicModal
          onClose={() => setNewTopicOpen(false)}
          onCreated={(t) => {
            setTopics((prev) => [...prev, t]);
            setActiveTopic(t);
            setPanel("chat");
          }}
        />
      )}
    </div>
  );
}
