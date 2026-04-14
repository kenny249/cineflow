"use client";

import { useState } from "react";
import { Sparkles, Camera, Users, Check } from "lucide-react";
import { toast } from "sonner";
import { HeroPreview } from "./HeroPreview";
import { PageParticles } from "./PageParticles";
import { HexField } from "./HexField";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateDisplayName } from "@/lib/random-name";
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

  const planValue = selectedPlan === "solo" ? "solo_beta" : "studio_beta";

  async function handleBetaAccess() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planValue }),
      });
      const json = await res.json();
      if (!res.ok || !json.action_link) {
        toast.error("Could not start demo. Please try again.");
        setIsLoading(false);
        return;
      }
      // Redirect through Supabase's verify endpoint → our auth callback → /welcome
      window.location.assign(json.action_link);
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
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ??
        (typeof window !== "undefined" ? window.location.origin : "https://www.usecineflow.com");

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${siteUrl}/auth/callback`,
          data: { full_name: getOrCreateDisplayName(), plan: planValue },
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
            {/* Magic link form */}
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
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-semibold text-white transition-all hover:border-[#d4a853]/30 hover:bg-white/[0.06] active:scale-[0.98] disabled:opacity-60"
              >
                {isSendingLink ? "Sending link..." : "Email me a magic link"}
              </button>
              <p className="mt-2 text-center text-[11px] text-zinc-600">
                {linkSentTo
                  ? `Check ${linkSentTo}, your ${isSolo ? "solo" : "studio"} workspace is ready.`
                  : "No password needed. One click and you're in."}
              </p>
            </div>

            {/* Demo button */}
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
