"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Camera, Users, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { HeroPreview } from "./HeroPreview";
import { PageParticles } from "./PageParticles";
import { HexField } from "./HexField";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Plan = "solo" | "studio";

const PLANS: { id: Plan; icon: typeof Camera; label: string; desc: string }[] = [
  {
    id: "solo",
    icon: Camera,
    label: "Solo Creator",
    desc: "Individual filmmakers, YouTubers & content creators",
  },
  {
    id: "studio",
    icon: Users,
    label: "Film Studio",
    desc: "Short films, commercials & production companies",
  },
];

function GrainOverlay() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] h-full w-full"
      style={{ opacity: 0.13, mixBlendMode: "overlay" }}
    >
      <defs>
        <filter id="cf-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#cf-grain)" />
    </svg>
  );
}

export function LoginPageClient() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>("studio");
  const [isLoading, setIsLoading]       = useState(false);
  const [email, setEmail]               = useState("");
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [linkSentTo, setLinkSentTo]     = useState<string | null>(null);
  const CODE_LENGTH = 6;
  const [digits, setDigits]             = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [isVerifying, setIsVerifying]   = useState(false);
  const [otpError, setOtpError]         = useState<string | null>(null);
  const digitRefs                       = useRef<Array<HTMLInputElement | null>>([]);

  const planValue = selectedPlan === "solo" ? "solo_beta" : "studio_beta";

  // Auto-focus first digit box when OTP step appears
  useEffect(() => {
    if (linkSentTo) setTimeout(() => digitRefs.current[0]?.focus(), 100);
  }, [linkSentTo]);

  async function handleVerifyOtp(code: string) {
    if (code.length !== CODE_LENGTH || !linkSentTo) return;
    setIsVerifying(true);
    setOtpError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email: linkSentTo,
        token: code,
        type: "email",
      });
      if (error || !data.user) {
        setOtpError("Incorrect code. Check your email and try again.");
        setDigits(Array(CODE_LENGTH).fill(""));
        setTimeout(() => digitRefs.current[0]?.focus(), 50);
        setIsVerifying(false);
        return;
      }
      // Upsert profile with plan
      try {
        await supabase.from("profiles").upsert(
          { id: data.user.id, email: data.user.email, plan: planValue, updated_at: new Date().toISOString() },
          { onConflict: "id" }
        );
        sessionStorage.setItem("cf_plan", planValue);
        const { data: profile } = await supabase
          .from("profiles").select("first_name, last_name").eq("id", data.user.id).single();
        if (profile?.first_name || profile?.last_name) {
          localStorage.setItem("cf_display_name", [profile.first_name, profile.last_name].filter(Boolean).join(" "));
        }
      } catch { /* non-fatal */ }
      window.location.replace("/welcome");
    } catch {
      setOtpError("Something went wrong. Please try again.");
      setIsVerifying(false);
    }
  }

  function handleDigitChange(index: number, value: string) {
    // Handle paste of full code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
      if (pasted.length === CODE_LENGTH) {
        const next = pasted.split("");
        setDigits(next);
        digitRefs.current[CODE_LENGTH - 1]?.focus();
        handleVerifyOtp(pasted);
        return;
      }
    }
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setOtpError(null);
    if (digit && index < CODE_LENGTH - 1) digitRefs.current[index + 1]?.focus();
    const code = next.join("");
    if (code.length === CODE_LENGTH && !next.includes("")) handleVerifyOtp(code);
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  }

  async function handleBetaAccess() {
    setIsLoading(true);
    try {
      // Server creates an ephemeral account and seeds demo data
      const res = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planValue }),
      });
      const json = await res.json();
      if (!res.ok || !json.email || !json.password) {
        console.error("[demo] start failed:", json?.error, json?.detail);
        toast.error("Could not start demo. Please try again.");
        setIsLoading(false);
        return;
      }

      // Sign in directly — no redirects, no hash tokens in the URL
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: json.email,
        password: json.password,
      });
      if (error || !data.session) {
        console.error("[demo] signIn failed:", error?.message);
        toast.error("Could not start demo. Please try again.");
        setIsLoading(false);
        return;
      }

      sessionStorage.setItem("cf_plan", planValue);
      window.location.assign("/welcome");
    } catch {
      toast.error("Demo sign-in failed. Please try again.");
      setIsLoading(false);
    }
  }

  async function handleMagicLink() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.error("Enter your email first.");
      return;
    }

    setIsSendingLink(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          data: { plan: planValue },
        },
      });

      if (error) {
        toast.error(
          error.message.includes("fetch failed")
            ? "Unable to reach Supabase. Check your project URL and network."
            : error.message
        );
        return;
      }

      setLinkSentTo(trimmedEmail);
      toast.success("Magic link sent.");
    } catch {
      toast.error("Could not send your magic link.");
    } finally {
      setIsSendingLink(false);
    }
  }

  const isSolo = selectedPlan === "solo";

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <PageParticles />
      <GrainOverlay />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,168,83,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(212,168,83,0.06),transparent_35%)]" />
      <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-[#d4a853]/10 blur-3xl" />
      <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-[#d4a853]/8 blur-3xl" />

      {/* Left: Login Panel */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 md:w-1/2 lg:w-2/5">
        <div className="animate-card-rise relative w-full max-w-sm rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 bg-card/95 p-8 sm:p-10 backdrop-blur-xl">

          {/* Badge */}
          <div className="mb-8 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.25em] text-zinc-400 uppercase bg-white/[0.04]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Private Beta, Now Open
            </span>
          </div>

          {/* Wordmark + headline */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <p className="text-[0.6rem] font-bold tracking-[0.35em] text-[#d4a853] uppercase">CineFlow</p>
              <span className="text-[0.6rem] font-light tracking-wide text-zinc-400" style={{fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em'}}>by Maltav</span>
            </div>
            <h2 className="text-[1.55rem] font-bold leading-tight tracking-tight text-foreground">
              Built for every filmmaker.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Pick your experience, both are free during beta.
            </p>
          </div>

          {/* Plan selector */}
          <div className="mb-6 grid grid-cols-2 gap-2">
            {PLANS.map(({ id, icon: Icon, label, desc }) => {
              const active = selectedPlan === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setSelectedPlan(id); setLinkSentTo(null); }}
                  className={cn(
                    "relative flex flex-col items-start rounded-xl border p-3 text-left transition-all duration-200 active:scale-[0.98]",
                    active
                      ? "border-[#d4a853]/60 bg-[#d4a853]/[0.07] shadow-[0_0_20px_rgba(212,168,83,0.12)]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  )}
                >
                  {active && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a853]">
                      <Check className="h-2.5 w-2.5 text-black" />
                    </span>
                  )}
                  <div className={cn(
                    "mb-2 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                    active ? "border-[#d4a853]/40 bg-[#d4a853]/15" : "border-white/10 bg-white/[0.04]"
                  )}>
                    <Icon className={cn("h-4 w-4", active ? "text-[#d4a853]" : "text-zinc-500")} />
                  </div>
                  <p className={cn("text-xs font-bold leading-tight", active ? "text-white" : "text-zinc-400")}>
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-tight text-zinc-600">{desc}</p>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {!linkSentTo ? (
              /* ── Step 1: Email entry ── */
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <label htmlFor="beta-email" className="mb-2 block text-left text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                  {isSolo ? "Start Solo Beta" : "Start Studio Beta"}
                </label>
                <input
                  id="beta-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
                  placeholder={isSolo ? "you@gmail.com" : "you@studio.com"}
                  className="mb-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#d4a853]/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={isSendingLink}
                  className="w-full rounded-xl border border-[#d4a853]/40 bg-[#d4a853]/10 py-3 text-sm font-semibold text-[#d4a853] transition-all hover:border-[#d4a853]/60 hover:bg-[#d4a853]/15 active:scale-[0.98] disabled:opacity-60"
                >
                  {isSendingLink ? "Sending…" : "Email me a code"}
                </button>
                <p className="mt-2 text-center text-[11px] text-zinc-600">
                  No password needed. Works in any browser.
                </p>
              </div>
            ) : (
              /* ── Step 2: OTP code entry ── */
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <button
                  type="button"
                  onClick={() => { setLinkSentTo(null); setDigits(Array(CODE_LENGTH).fill("")); setOtpError(null); }}
                  className="mb-3 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>

                <p className="mb-1 text-sm font-semibold text-white">Check your email</p>
                <p className="mb-4 text-[11px] text-zinc-500">
                  We sent a login code to <span className="text-zinc-300">{linkSentTo}</span>
                </p>

                {/* 6-digit boxes */}
                <div className="mb-4 flex justify-between gap-2">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { digitRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      onFocus={(e) => e.target.select()}
                      disabled={isVerifying}
                      className={cn(
                        "h-12 w-full rounded-xl border text-center text-lg font-bold text-white transition-all focus:outline-none disabled:opacity-50",
                        d
                          ? "border-[#d4a853]/60 bg-[#d4a853]/10 text-[#d4a853]"
                          : "border-white/10 bg-black/20 focus:border-[#d4a853]/40"
                      )}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="mb-3 text-center text-[11px] text-red-400">{otpError}</p>
                )}

                {isVerifying ? (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d4a853]/20 border-t-[#d4a853]" />
                    <span className="text-xs text-zinc-400">Verifying…</span>
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-zinc-600">
                    Didn&apos;t get it?{" "}
                    <button
                      type="button"
                      onClick={() => { setDigits(Array(CODE_LENGTH).fill("")); setOtpError(null); handleMagicLink(); }}
                      className="text-zinc-400 underline underline-offset-2 hover:text-white transition-colors"
                    >
                      Resend code
                    </button>
                  </p>
                )}
              </div>
            )}

            {/* Demo button — hide once user is in OTP step */}
            {!linkSentTo && (
              <button
                onClick={handleBetaAccess}
                disabled={isLoading}
                className="group relative w-full overflow-hidden rounded-2xl bg-[#d4a853] py-4 text-[0.95rem] font-bold text-black transition-all hover:bg-[#e0b55e] active:scale-[0.98] disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Opening demo…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Try {isSolo ? "Solo" : "Studio"} Demo, No signup
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                )}
              </button>
            )}
          </div>

          <p className="mt-5 text-center text-[11px] text-zinc-600">
            Both plans are free during beta. Your workspace and projects are saved privately.
          </p>
        </div>
      </div>

      {/* Right: Hero Preview */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden border-l border-border bg-[#070707] px-8 py-10 md:flex">
        <HexField />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        <div className="relative z-10 flex w-full items-center justify-center">
          <HeroPreview />
        </div>
      </div>
    </div>
  );
}
