"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Film, LogOut, Send, ArrowLeft } from "lucide-react";
import type { ProjectMessage } from "@/types";

interface CollabProjectDetail {
  id: string;
  title: string;
  client_name?: string;
  status: string;
  description?: string;
  shoot_date?: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

export default function CollabProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<CollabProjectDetail | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, is_collaborator")
        .eq("id", user.id)
        .single();

      if (profile && !profile.is_collaborator) {
        router.replace("/dashboard");
        return;
      }

      if (profile?.first_name || profile?.last_name) {
        setDisplayName([profile.first_name, profile.last_name].filter(Boolean).join(" "));
      }

      // Verify this collaborator is active on this project
      const { data: collab } = await supabase
        .from("project_collaborators")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (!collab) {
        router.replace("/collab");
        return;
      }

      const { data: proj } = await supabase
        .from("projects")
        .select("id, title, client_name, status, description, shoot_date")
        .eq("id", projectId)
        .single();

      setProject(proj ?? null);

      const { data: msgs } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(100);

      setMessages(msgs ?? []);
      setLoading(false);
    }

    load();
  }, [projectId, router]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`project_messages:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as ProjectMessage];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");

    const res = await fetch(`/api/projects/${projectId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, author_name: displayName || "Collaborator" }),
    });

    if (!res.ok) {
      setInput(content);
    }
    setSending(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Group messages by date
  const grouped: { date: string; msgs: ProjectMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date, msgs: [msg] });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0b]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d4a853] border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0b]">
        <p className="text-sm text-white/30">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0b0b] text-white">
      <div className="pointer-events-none fixed left-0 top-0 h-64 w-full bg-[radial-gradient(ellipse_60%_40%_at_30%_0%,rgba(212,168,83,0.06),transparent)]" />

      {/* Header */}
      <header className="border-b border-white/[0.06] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/collab")}
              className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/12">
                <Film className="h-3.5 w-3.5 text-[#d4a853]" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xs font-semibold tracking-tight text-white/80">Cineflow</span>
                <span className="text-[9px] text-white/20 tracking-widest uppercase">Project Workspace</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {displayName && <span className="text-xs text-white/40">{displayName}</span>}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/40 hover:text-white hover:border-white/20 transition-colors"
            >
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-6 pt-8 sm:px-8">
        {/* Project info */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">{project.title}</h1>
              {project.client_name && (
                <p className="mt-0.5 text-sm text-white/40">{project.client_name}</p>
              )}
              {project.description && (
                <p className="mt-2 text-sm text-white/50 leading-relaxed max-w-xl">{project.description}</p>
              )}
            </div>
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${
              project.status === "active"    ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" :
              project.status === "review"    ? "text-amber-400 border-amber-400/20 bg-amber-400/10" :
              project.status === "delivered" ? "text-blue-400 border-blue-400/20 bg-blue-400/10" :
              "text-white/30 border-white/10 bg-white/5"
            }`}>
              {project.status}
            </span>
          </div>
          {project.shoot_date && (
            <p className="mt-2 text-xs text-white/30">
              Shoot date: {new Date(project.shoot_date).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Chat section */}
        <div className="flex flex-col flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Project Chat</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ minHeight: 320, maxHeight: "calc(100vh - 480px)" }}>
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center py-16">
                <p className="text-sm text-white/20">No messages yet — start the conversation.</p>
              </div>
            ) : (
              grouped.map(({ date, msgs }) => (
                <div key={date}>
                  <div className="flex items-center gap-3 py-3">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <span className="text-[10px] text-white/20">{date}</span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                  {msgs.map((msg, i) => {
                    const isMe = msg.author_id === userId;
                    const prevMsg = i > 0 ? msgs[i - 1] : null;
                    const showAuthor = !prevMsg || prevMsg.author_id !== msg.author_id;

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${showAuthor ? "mt-3" : "mt-0.5"}`}>
                        {showAuthor && (
                          <span className={`mb-1 text-[10px] text-white/30 ${isMe ? "mr-1" : "ml-1"}`}>
                            {isMe ? "You" : msg.author_name}
                          </span>
                        )}
                        <div className="flex items-end gap-2">
                          {!isMe && (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/50">
                              {msg.author_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className={`max-w-xs rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            isMe
                              ? "bg-[#d4a853] text-black rounded-br-sm"
                              : "bg-white/[0.06] text-white/90 rounded-bl-sm"
                          }`}>
                            {msg.content}
                          </div>
                          <span className="text-[9px] text-white/15 shrink-0">{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/[0.06] p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message the team…"
                className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#d4a853]/30 transition-colors"
                disabled={sending}
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
      </main>
    </div>
  );
}
