"use client";

import { useState } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { toast } from "sonner";

type FeedbackType = "bug" | "idea" | "other";

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug report",
  idea: "Feature idea",
  other: "General",
};

const PLACEHOLDERS: Record<FeedbackType, string> = {
  bug: "Describe what went wrong and how to reproduce it...",
  idea: "Share your feature idea or improvement...",
  other: "Tell us anything on your mind...",
};

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<FeedbackType>("other");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const existing: unknown[] = JSON.parse(localStorage.getItem("cf_feedback") ?? "[]");
      existing.push({ type, text: text.trim(), at: new Date().toISOString() });
      localStorage.setItem("cf_feedback", JSON.stringify(existing));
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    setSending(false);
    setText("");
    setOpen(false);
    toast.success("Thanks for the feedback! We appreciate it.", { duration: 4000 });
  };

  return (
    <>
      {/* Floating trigger — above mobile nav, bottom-right on desktop */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[4.5rem] right-4 z-40 flex items-center gap-2 rounded-full border border-[#d4a853]/20 bg-card/95 px-3.5 py-2 text-xs font-medium text-[#d4a853] shadow-lg backdrop-blur-md transition-all hover:border-[#d4a853]/40 hover:shadow-[0_0_18px_rgba(212,168,83,0.15)] md:bottom-6 md:right-6"
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        <span>Feedback</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center p-4 md:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground">Send feedback</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Help us improve Cineflow for beta.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="mt-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Type pills */}
            <div className="flex gap-2 px-5 pt-4">
              {(Object.keys(TYPE_LABELS) as FeedbackType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    type === t
                      ? "border-[#d4a853]/40 bg-[#d4a853]/10 text-[#d4a853]"
                      : "border-border text-muted-foreground hover:border-border/60 hover:text-foreground"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div className="px-5 py-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
                }}
                placeholder={PLACEHOLDERS[type]}
                rows={4}
                className="w-full resize-none rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-2 focus:ring-[#d4a853]/20 transition-all"
              />
              <p className="mt-1.5 text-[10px] text-muted-foreground">⌘↵ to send</p>
            </div>

            {/* Submit */}
            <div className="border-t border-border px-5 py-3">
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || sending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#d4a853]/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
