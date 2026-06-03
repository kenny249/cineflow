"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function WrapLandingPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/wrap/dashboard");
      else setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/wrap/dashboard` },
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-6 w-6 animate-spin text-[#d4a853]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10">
          <Receipt className="h-7 w-7 text-[#d4a853]" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.35em] text-[#d4a853] uppercase">Wrap</p>
          <p className="text-[10px] text-zinc-500 tracking-widest uppercase">by CineFlow</p>
        </div>
      </div>

      <div className="w-full max-w-xs">
        {sent ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#111] p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Check your email</p>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                We sent a magic link to <span className="text-white">{email}</span>. Tap it to sign in.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#111] p-7">
            <h1 className="mb-1 text-lg font-bold text-white">Track expenses on set</h1>
            <p className="mb-6 text-sm text-zinc-400 leading-relaxed">
              Snap a receipt, we read it. Bill it to your client in seconds.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
              />
              <button
                type="submit"
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3 text-sm font-bold text-black transition hover:bg-[#d4a853]/90 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Get started <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] text-zinc-600">
              No password needed. We&apos;ll email you a link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
