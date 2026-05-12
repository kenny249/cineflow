"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectMessage } from "@/types";

interface ChatTabProps {
  projectId: string;
  displayName: string;
  userId: string;
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

export function ChatTab({ projectId, displayName, userId }: ChatTabProps) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/messages`)
      .then((r) => r.json())
      .then((data) => { setMessages(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project_messages:${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_messages", filter: `project_id=eq.${projectId}` },
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
      body: JSON.stringify({ content, author_name: displayName || "Team Member" }),
    });

    if (!res.ok) setInput(content);
    setSending(false);
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

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
      <div className="border-b border-border px-5 sm:px-6 py-3">
        <h3 className="font-display text-sm font-semibold text-foreground">Project Chat</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Real-time conversation with your project team and collaborators.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-0.5">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No messages yet — say hello!</p>
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
                      <div className={`max-w-xs rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        isMe
                          ? "bg-[#d4a853] text-black rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}>
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-muted-foreground/50 shrink-0">{formatTime(msg.created_at)}</span>
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
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Message the team…"
            className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#d4a853]/50 transition-colors"
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
  );
}
