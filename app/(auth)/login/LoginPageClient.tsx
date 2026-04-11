"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
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
  const leftCardRef  = useRef<HTMLDivElement>(null);
  const leftSpecRef  = useRef<HTMLDivElement>(null);
  const rightCardRef = useRef<HTMLDivElement>(null);

  const mouseRef  = useRef({ x: 0.5, y: 0.5 });
  const lerpedRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef    = useRef<number>(0);
  const readyRef  = useRef(false);

  const [isLoading, setIsLoading] = useState(false);

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
            options: { emailRedirectTo: `${window.location.origin}/login`, data: { full_name: displayName } },
          });
          if (!se && sd?.session) { window.location.assign("/welcome"); return; }
        }
        setIsLoading(false);
        return;
      }
      if (data?.session) window.location.assign("/welcome");
    } catch { setIsLoading(false); }
  }

  useEffect(() => {
    // Delay tilt start so it doesn't fight the card-rise CSS animation (650ms)
    const timer = setTimeout(() => { readyRef.current = true; }, 720);

    const onMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", onMove);

    const tick = () => {
      if (readyRef.current) {
        const EASE = 0.065;
        lerpedRef.current.x += (mouseRef.current.x - lerpedRef.current.x) * EASE;
        lerpedRef.current.y += (mouseRef.current.y - lerpedRef.current.y) * EASE;

        const nx = (lerpedRef.current.x - 0.5) * 2; // -1…1
        const ny = (lerpedRef.current.y - 0.5) * 2;

        // ── Left card: deeper 3D tilt ──
        if (leftCardRef.current) {
          const ry = nx * 9;
          const rx = -ny * 6;
          leftCardRef.current.style.transform =
            `perspective(860px) rotateY(${ry}deg) rotateX(${rx}deg)`;
          const shadowX   = (-nx * 28).toFixed(1);
          const shadowY   = (ny * 8 + 28).toFixed(1);
          const shadowBlur = (80 + Math.abs(nx) * 36).toFixed(1);
          const bOpacity   = (0.07 + Math.abs(nx) * 0.07).toFixed(3);
          leftCardRef.current.style.boxShadow =
            `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0,0,0,0.52),` +
            `0 0 0 1px rgba(255,255,255,${bOpacity})`;
        }

        // ── Left specular highlight ──
        if (leftCardRef.current && leftSpecRef.current) {
          const rect = leftCardRef.current.getBoundingClientRect();
          const sx = (((mouseRef.current.x * window.innerWidth)  - rect.left) / rect.width  * 100).toFixed(1);
          const sy = (((mouseRef.current.y * window.innerHeight) - rect.top)  / rect.height * 100).toFixed(1);
          leftSpecRef.current.style.background =
            `radial-gradient(ellipse 75% 65% at ${sx}% ${sy}%, rgba(255,255,255,0.052) 0%, transparent 62%)`;
        }

        // ── Right card: gentler tilt ──
        if (rightCardRef.current) {
          const ry = nx * 5;
          const rx = -ny * 3.5;
          rightCardRef.current.style.transform =
            `perspective(1300px) rotateY(${ry}deg) rotateX(${rx}deg)`;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
          ref={leftCardRef}
          className="animate-card-rise relative w-full max-w-sm rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 bg-card/95 p-8 sm:p-10 backdrop-blur-xl"
          style={{ willChange: "transform" }}
        >
          {/* Specular sheen layer */}
          <div ref={leftSpecRef} className="pointer-events-none absolute inset-0 rounded-[2rem]" />

          {/* Beta badge */}
          <div className="mb-8 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.25em] text-zinc-400 uppercase bg-white/[0.04]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Beta Access · Limited
            </span>
          </div>

          {/* Wordmark + tagline */}
          <div className="mb-10 text-center">
            <p className="text-[0.6rem] font-bold tracking-[0.35em] text-[#d4a853] uppercase mb-3">CineFlow</p>
            <h2 className="text-[1.65rem] font-bold leading-tight tracking-tight text-foreground">
              Studio flow for<br />every production.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Built for filmmakers, directors<br className="hidden sm:block" /> &amp; creative teams.
            </p>
          </div>

          {/* Single CTA */}
          <button
            onClick={handleBetaAccess}
            disabled={isLoading}
            className="group relative w-full overflow-hidden rounded-2xl bg-[#d4a853] py-4 text-[0.95rem] font-bold text-black transition-all hover:bg-[#e0b55e] active:scale-[0.98] disabled:opacity-60"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Getting you in…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4" />
                Enter Beta
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            )}
          </button>

          <p className="mt-5 text-center text-[11px] text-zinc-600">
            No account needed &mdash; one tap &amp; you&apos;re in.
          </p>
        </div>
      </div>

      {/* Right: Hero Preview */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden border-l border-border bg-[#070707] px-8 py-10 md:flex">
        {/* Hex grid texture — lowest layer */}
        <HexField />
        {/* Ambient vignette — corners stay dark */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        <div
          ref={rightCardRef}
          className="relative z-10 flex w-full items-center justify-center"
          style={{ willChange: "transform" }}
        >
          <HeroPreview />
        </div>
      </div>
    </div>
  );
}
