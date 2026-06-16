"use client";

import { useState, useEffect } from "react";
import { Send, Users, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Segment = {
  value: string;
  label: string;
  description: string;
};

const SEGMENTS: Segment[] = [
  { value: "all",          label: "All users",        description: "Every real account" },
  { value: "trialing",     label: "Trialing",         description: "Active trials only" },
  { value: "paid",         label: "Paid",             description: "Active + founding + lifetime" },
  { value: "trial_expired",label: "Trial expired",    description: "Trialed but didn't convert" },
  { value: "solo",         label: "Solo plan",        description: "Solo subscribers" },
  { value: "studio",       label: "Studio plan",      description: "Studio subscribers" },
  { value: "agency",       label: "Agency plan",      description: "Agency subscribers" },
  { value: "enterprise",   label: "Enterprise",       description: "Enterprise subscribers" },
  { value: "lifetime",     label: "Lifetime",         description: "Lifetime access holders" },
];

const TEMPLATES = [
  {
    label: "Trial ending soon",
    subject: "Your CineFlow trial is ending soon",
    message: `Hey there,

Just a quick heads-up — your CineFlow trial is ending soon.

We hope you've had a chance to explore everything CineFlow has to offer: professional invoices, client portals, contracts, scheduling, and more — all built for film and video creators.

If you have any questions before your trial ends, just reply to this email. We're happy to help.

Keep creating,
The CineFlow Team`,
  },
  {
    label: "New feature announcement",
    subject: "New in CineFlow: [Feature Name]",
    message: `Hey there,

We just shipped something we think you're going to love.

[Describe the feature in 2-3 sentences]

Head over to your dashboard to check it out →

As always, if you have feedback or questions, just hit reply.

The CineFlow Team`,
  },
  {
    label: "Welcome + tips",
    subject: "Getting the most out of CineFlow",
    message: `Hey there,

Thanks for signing up for CineFlow — we're excited to have you.

Here are a few things to get started:

1. Create your first project to keep everything organized
2. Send a professional invoice in under 2 minutes
3. Set up a client portal so your clients can approve work online

If you ever get stuck or have ideas, just reply to this email.

The CineFlow Team`,
  },
];

export function BroadcastClient() {
  const [segment, setSegment] = useState("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; errors?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    setCount(null);
    setResult(null);
    setLoadingCount(true);
    fetch(`/api/admin/broadcast?segment=${segment}`)
      .then((r) => r.json())
      .then((d) => { setCount(d.count ?? 0); setLoadingCount(false); })
      .catch(() => setLoadingCount(false));
  }, [segment]);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function applyTemplate(t: typeof TEMPLATES[0]) {
    setSubject(t.subject);
    setMessage(t.message);
    setShowTemplates(false);
  }

  const seg = SEGMENTS.find((s) => s.value === segment)!;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Broadcast Email</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Send an email to a segment of your users via Resend</p>
      </div>

      {result ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-lg font-semibold text-emerald-300">Broadcast sent</p>
          </div>
          <p className="text-zinc-300">
            Delivered to <span className="font-bold text-white">{result.sent}</span> recipient{result.sent !== 1 ? "s" : ""}.
          </p>
          {result.errors && result.errors.length > 0 && (
            <p className="mt-2 text-sm text-red-400">{result.errors.length} batch(es) failed: {result.errors[0]}</p>
          )}
          <button
            onClick={() => { setResult(null); setSubject(""); setMessage(""); }}
            className="mt-4 rounded-lg bg-white/[0.06] px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.1] transition-colors"
          >
            Send another
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Segment selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Recipient segment</label>
            <div className="grid grid-cols-3 gap-2">
              {SEGMENTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSegment(s.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition-colors",
                    segment === s.value
                      ? "border-[#d4a853]/40 bg-[#d4a853]/10 text-[#d4a853]"
                      : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/[0.1] hover:text-zinc-300"
                  )}
                >
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="mt-0.5 text-[10px] opacity-70">{s.description}</p>
                </button>
              ))}
            </div>

            {/* Recipient count */}
            <div className="mt-2 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-zinc-600" />
              <p className="text-xs text-zinc-500">
                {loadingCount ? "Counting…" : count === null ? "" : (
                  <span>
                    <span className="font-semibold text-zinc-300">{count}</span> recipient{count !== 1 ? "s" : ""}
                    {count === 0 && <span className="ml-2 text-amber-400">— no emails will be sent</span>}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Templates */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Compose</label>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Templates
                <ChevronDown className={cn("h-3 w-3 transition-transform", showTemplates && "rotate-180")} />
              </button>
            </div>
            {showTemplates && (
              <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t)}
                    className="w-full px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <p className="text-sm font-medium text-zinc-300">{t.label}</p>
                    <p className="text-xs text-zinc-600 truncate mt-0.5">{t.subject}</p>
                  </button>
                ))}
              </div>
            )}

            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line"
              className="mb-3 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[#d4a853]/40 focus:outline-none"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here…"
              rows={12}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-[#d4a853]/40 focus:outline-none resize-none font-mono leading-relaxed"
            />
          </div>

          {/* Preview & send */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-zinc-600">
              Sends plain-text HTML via Resend · logged to audit trail
            </p>
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !message.trim() || count === 0}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
                sending || !subject.trim() || !message.trim() || count === 0
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-[#d4a853] text-black hover:bg-[#d4a853]/90"
              )}
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : `Send to ${count ?? "?"} users`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
