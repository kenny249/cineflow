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
  ChevronDown,
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

function ChatBubble({ msg, isOwn, onDelete }: { msg: TeamMessage; isOwn: boolean; onDelete: () => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const time = new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className={`group flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}>
      <div className="mt-1 shrink-0">
        <MemberAvatar member={{ full_name: msg.author?.full_name, email: msg.author?.email, avatar_url: msg.author?.avatar_url }} size="sm" />
      </div>
      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        <div className={`flex items-center gap-2 text-[10px] text-muted-foreground ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="font-medium">{msg.author?.full_name ?? msg.author?.email ?? "Unknown"}</span>
          <span>{time}</span>
        </div>
        <div className={`relative rounded-2xl px-3.5 py-2 text-sm ${isOwn ? "rounded-tr-sm bg-[#d4a853] text-black" : "rounded-tl-sm bg-muted/60 text-foreground"}`}>
          {msg.content}
          {isOwn && (
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="absolute -left-7 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
          {showMenu && (
            <div className="absolute left-0 top-8 z-10 rounded-lg border border-border bg-card shadow-xl">
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 w-full rounded-lg transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          )}
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
  const [activePanel, setActivePanel] = useState<"chat" | "members">("chat");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load data + current user
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    getTeamMembers().then(setMembers).catch(() => {});
    getTeamTopics().then((t) => {
      setTopics(t);
      if (t.length > 0) setActiveTopic(t[0]);
    }).catch(() => {});
  }, []);

  // Load messages when topic changes
  useEffect(() => {
    if (!activeTopic) return;
    setLoadingMessages(true);
    getTeamMessages(activeTopic.id)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [activeTopic]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !activeTopic || sending) return;
    const content = message.trim();
    setMessage("");
    setSending(true);
    try {
      const msg = await sendTeamMessage(activeTopic.id, content);
      setMessages((prev) => [...prev, msg]);
    } catch {
      toast.error("Failed to send message");
      setMessage(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
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
    try { await removeTeamMember(id); toast.success("Member removed"); }
    catch { toast.error("Failed to remove member"); }
    setMemberMenuId(null);
  }

  async function handleRoleChange(id: string, role: TeamMember["role"]) {
    try {
      const updated = await updateTeamMemberRole(id, role);
      setMembers((prev) => prev.map((m) => m.id === id ? updated : m));
    } catch { toast.error("Failed to update role"); }
    setMemberMenuId(null);
  }

  async function handleDeleteTopic(id: string) {
    setTopics((prev) => prev.filter((t) => t.id !== id));
    if (activeTopic?.id === id) setActiveTopic(topics.find((t) => t.id !== id) ?? null);
    try { await deleteTeamTopic(id); }
    catch { toast.error("Failed to delete topic"); }
  }

  const activeCount = members.filter((m) => m.status === "active").length;
  const pendingCount = members.filter((m) => m.status === "pending").length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Team</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activeCount} active{pendingCount > 0 ? `, ${pendingCount} pending` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePanel(activePanel === "chat" ? "members" : "chat")}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-[#d4a853]/30 hover:text-foreground"
          >
            {activePanel === "chat" ? <Users className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
            {activePanel === "chat" ? "Members" : "Chat"}
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
        <div className="flex w-52 shrink-0 flex-col border-r border-border bg-card/30">
          <div className="flex items-center justify-between px-3 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Topics</span>
            <button
              onClick={() => setNewTopicOpen(true)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50"
              title="New topic"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
            {topics.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">No topics yet</p>
            )}
            {topics.map((topic) => (
              <div key={topic.id} className="group relative">
                <button
                  onClick={() => { setActiveTopic(topic); setActivePanel("chat"); }}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-all ${activeTopic?.id === topic.id ? "bg-[#d4a853]/12 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
                >
                  <span className="text-base leading-none">{topic.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-xs">{topic.name}</span>
                </button>
                {topic.name !== "general" && (
                  <button
                    onClick={() => handleDeleteTopic(topic.id)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 hidden rounded p-0.5 text-muted-foreground hover:text-red-400 group-hover:flex"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Members mini strip */}
          <div className="border-t border-border p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Members</div>
            {members.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No members yet</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {members.slice(0, 8).map((m) => (
                  <div key={m.id} title={m.name ?? m.email} className={`relative ${m.status === "active" ? "" : "opacity-50"}`}>
                    <MemberAvatar member={m} size="sm" />
                    {m.status === "active" && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-1 ring-card" />
                    )}
                  </div>
                ))}
                {members.length > 8 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-[10px] text-muted-foreground">
                    +{members.length - 8}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Chat or Members ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {activePanel === "chat" ? (
            <>
              {/* Chat header */}
              {activeTopic && (
                <div className="flex items-center gap-2 border-b border-border px-4 py-3 shrink-0">
                  <span className="text-xl">{activeTopic.emoji}</span>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{activeTopic.name}</h2>
                    {activeTopic.description && (
                      <p className="text-[11px] text-muted-foreground">{activeTopic.description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
                {!activeTopic && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <Hash className="h-12 w-12 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Select a topic to start chatting</p>
                  </div>
                )}
                {activeTopic && loadingMessages && (
                  <div className="flex justify-center py-8">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
                  </div>
                )}
                {activeTopic && !loadingMessages && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <div className="text-4xl">{activeTopic.emoji}</div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Welcome to #{activeTopic.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activeTopic.description ?? "Start the conversation."}</p>
                    </div>
                  </div>
                )}
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={msg.author_id === currentUserId}
                    onDelete={() => handleDeleteMessage(msg.id)}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {activeTopic && (
                <form onSubmit={handleSend} className="shrink-0 border-t border-border p-4">
                  <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 focus-within:border-[#d4a853]/40 focus-within:ring-1 focus-within:ring-[#d4a853]/20 transition-all">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message #${activeTopic.name}`}
                      className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      style={{ maxHeight: "120px" }}
                    />
                    <button
                      type="submit"
                      disabled={!message.trim() || sending}
                      className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d4a853] text-black transition-all hover:bg-[#c49843] disabled:opacity-40"
                    >
                      {sending ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground/60">Enter to send · Shift+Enter for new line</p>
                </form>
              )}
            </>
          ) : (
            /* ── Members panel ── */
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-foreground">Team Members</h2>
                <button
                  onClick={() => setInviteOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/8 px-3 py-1.5 text-xs font-medium text-[#d4a853] hover:bg-[#d4a853]/15 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite
                </button>
              </div>

              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Users className="h-12 w-12 text-muted-foreground/30" />
                  <div>
                    <p className="text-sm font-medium text-foreground">No team members yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Invite colleagues to collaborate</p>
                  </div>
                  <button
                    onClick={() => setInviteOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Invite First Member
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="group relative flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-[#d4a853]/20">
                      <div className="relative">
                        <MemberAvatar member={member} size="md" />
                        {member.status === "active" && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">{member.name ?? member.email}</span>
                          {member.status === "pending" && (
                            <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-500">
                              Invited
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                      <RoleBadge role={member.role} />

                      {/* Member menu */}
                      <div className="relative ml-1">
                        <button
                          onClick={() => setMemberMenuId(memberMenuId === member.id ? null : member.id)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-foreground hover:bg-muted/50"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {memberMenuId === member.id && (
                          <div className="absolute right-0 top-7 z-20 w-40 rounded-xl border border-border bg-card shadow-xl">
                            <div className="p-1">
                              <p className="px-2 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Change role</p>
                              {(["member", "admin"] as TeamMember["role"][]).map((r) => (
                                <button
                                  key={r}
                                  onClick={() => handleRoleChange(member.id, r)}
                                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted/50 transition-colors"
                                >
                                  {ROLE_CONFIG[r].label}
                                  {member.role === r && <Check className="h-3 w-3 text-[#d4a853]" />}
                                </button>
                              ))}
                              <div className="my-1 border-t border-border" />
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                                Remove
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
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvited={(m) => setMembers((prev) => [...prev, m])}
        />
      )}
      {newTopicOpen && (
        <NewTopicModal
          onClose={() => setNewTopicOpen(false)}
          onCreated={(t) => {
            setTopics((prev) => [...prev, t]);
            setActiveTopic(t);
            setActivePanel("chat");
          }}
        />
      )}
    </div>
  );
}
