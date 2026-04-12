"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { HeroPreview } from "./HeroPreview";
import { PageParticles } from "./PageParticles";
import { HexField } from "./HexField";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateDisplayName } from "@/lib/random-name";

const DEMO_EMAIL    = "kenny@maltavmedia.com";
const DEMO_PASSWORD = "DopeDrops17!";

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
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

  async function handleBetaAccess() {
    setIsLoading(true);
    const displayName = getOrCreateDisplayName();
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (error) {
        if (error.message.toLowerCase().includes("user not found") ||
            error.message.toLowerCase().includes("invalid login credentials")) {
          const { data: sd, error: se } = await supabase.auth.signUp({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/login`, data: { full_name: displayName } },
          });
          if (!se && sd?.session) {
            const { data: confirmed } = await supabase.auth.getSession();
            if (confirmed.session) {
              window.location.assign("/welcome");
              return;
            }
          }
        }
        toast.error("Demo sign-in failed. Please try again.");
        setIsLoading(false);
        return;
      }
      const { data: confirmed } = await supabase.auth.getSession();
      if (!confirmed.session) {
        toast.error("Could not establish your session. Please try again.");
        setIsLoading(false);
        return;
      }
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
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
        ?? (typeof window !== "undefined" ? window.location.origin : "https://www.usecineflow.com");
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${siteUrl}/auth/confirm`,
          data: { full_name: getOrCreateDisplayName() },
        },
      });

      if (error) {
        toast.error(error.message.includes("fetch failed")
          ? "Unable to reach Supabase. Check your project URL and network."
          : error.message);
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

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <PageParticles />
      <GrainOverlay />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,168,83,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(212,168,83,0.06),transparent_35%)]" />
      <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-[#d4a853]/10 blur-3xl" />
      <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-[#d4a853]/8 blur-3xl" />

      {/* Left: Beta Gate */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 md:w-1/2 lg:w-2/5">
        <div
          className="animate-card-rise relative w-full max-w-sm rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 bg-card/95 p-8 sm:p-10 backdrop-blur-xl"
        >
          {/* Access badge */}
          <div className="mb-8 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.25em] text-zinc-400 uppercase bg-white/[0.04]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Private Beta · Two Ways In
            </span>
          </div>

          {/* Wordmark + tagline */}
          <div className="mb-10 text-center">
            <p className="text-[0.6rem] font-bold tracking-[0.35em] text-[#d4a853] uppercase mb-3">CineFlow</p>
            <h2 className="text-[1.65rem] font-bold leading-tight tracking-tight text-foreground">
              Enter instantly or<br />start your own beta.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Try the demo in one tap, or use a magic link for your private beta workspace.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <label htmlFor="beta-email" className="mb-2 block text-left text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Start Private Beta
              </label>
              <input
                id="beta-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
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
                {linkSentTo ? `Check ${linkSentTo} to open your private beta workspace.` : "No password, no setup friction."}
              </p>
            </div>

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
                  Try Demo
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              )}
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] text-zinc-600">
            Demo opens instantly. Private beta uses your email so your workspace stays yours.
          </p>
        </div>
      </div>

      {/* Right: Hero Preview */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden border-l border-border bg-[#070707] px-8 py-10 md:flex">
        {/* Hex grid texture — lowest layer */}
        <HexField />
        {/* Ambient vignette — corners stay dark */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        <div className="relative z-10 flex w-full items-center justify-center">
          <HeroPreview />
        </div>
      </div>
    </div>
  );
}
