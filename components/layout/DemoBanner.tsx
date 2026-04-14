"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X, Mail, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.is_demo === true) {
        setIsDemo(true);
      }
    });
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  };

  const handleClose = () => {
    setModalOpen(false);
    setEmail("");
    setStatus("idle");
    setErrorMsg("");
  };

  if (!isDemo || dismissed) return null;

  return (
    <>
      <div className="relative flex items-center justify-between gap-3 border-b border-[#d4a853]/20 bg-[#d4a853]/[0.07] px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-[#d4a853]">
          <FlaskConical className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">Demo Mode</span>
          <span className="hidden text-[#d4a853]/70 sm:inline">
            — You&apos;re exploring with sample data. Nothing you do here affects a real account.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg border border-[#d4a853]/40 bg-[#d4a853]/10 px-3 py-1 text-[11px] font-bold text-[#d4a853] transition-colors hover:bg-[#d4a853]/20"
          >
            Create real account
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-[#d4a853]/50 transition-colors hover:text-[#d4a853]"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Modal backdrop */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4a853]/15">
                  <FlaskConical className="h-3.5 w-3.5 text-[#d4a853]" />
                </div>
                <span className="text-sm font-semibold text-foreground">Join the beta</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              {status === "sent" ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Check your inbox</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      We sent a magic link to <span className="font-medium text-foreground">{email}</span>.
                      Click it to activate your account — no password needed.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                    Enter your email and we&apos;ll send you a magic link. One click and your real account is ready — no password required.
                  </p>
                  <form onSubmit={handleSend} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <input
                        type="email"
                        required
                        placeholder="you@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border bg-muted/40 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30 transition-colors"
                        autoFocus
                      />
                    </div>
                    {status === "error" && (
                      <p className="text-xs text-red-400">{errorMsg}</p>
                    )}
                    <button
                      type="submit"
                      disabled={status === "loading" || !email.trim()}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#d4a853] text-sm font-semibold text-black transition-all hover:bg-[#c49843] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status === "loading" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Send magic link
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
