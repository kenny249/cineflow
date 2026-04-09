"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroPreview } from "./HeroPreview";
import { LoginForm } from "./LoginForm";
import { PageParticles } from "./PageParticles";
import { HexField } from "./HexField";

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

      {/* Left: Login Form */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-12 md:w-1/2 lg:w-2/5">
        <div
          ref={leftCardRef}
          className="animate-card-rise relative w-full max-w-sm rounded-[2rem] border border-white/10 bg-card/95 p-8 backdrop-blur-xl"
          style={{ willChange: "transform" }}
        >
          {/* Specular sheen layer */}
          <div
            ref={leftSpecRef}
            className="pointer-events-none absolute inset-0 rounded-[2rem]"
          />

          <div className="mb-7">
            <p className="text-[0.65rem] font-bold tracking-[0.3em] text-[#d4a853] uppercase mb-1.5">CineFlow</p>
            <h2 className="text-xl font-bold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your studio account.</p>
          </div>

          <LoginForm />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">or</span>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2" size="lg">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground underline-offset-4 hover:text-[#d4a853] hover:underline"
            >
              Sign up free
            </Link>
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
