"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Film } from "lucide-react";

// Minimal ambient particles — only gold, very sparse
function AmbientDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 0.5 + Math.random() * 1.1,
      o: 0.03 + Math.random() * 0.08,
      gold: Math.random() < 0.3,
    }));

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? `rgba(212,168,83,${p.o})` : `rgba(255,255,255,${p.o * 0.5})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}

type Phase =
  | "dormant"
  | "icon"
  | "line"
  | "headline"
  | "wordmark"
  | "hold"
  | "exit"
  | "gone";

export default function WelcomePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("dormant");
  const [overlayOpacity, setOverlayOpacity] = useState(0);

  useEffect(() => {
    const q = (delay: number, fn: () => void) =>
      setTimeout(fn, delay);

    const t1 = q(180,  () => setPhase("icon"));
    const t2 = q(620,  () => setPhase("line"));
    const t3 = q(900,  () => setPhase("headline"));
    const t4 = q(1500, () => setPhase("wordmark"));
    const t5 = q(2600, () => setPhase("exit"));
    const t6 = q(3100, () => {
      setPhase("gone");
      window.location.assign("/dashboard");
    });

    return () => [t1, t2, t3, t4, t5, t6].forEach(clearTimeout);
  }, []);

  const isExit = phase === "exit" || phase === "gone";

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060606]"
      style={{ fontFamily: "inherit" }}
    >
      <AmbientDots />

      {/* Radial ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,rgba(212,168,83,0.07)_0%,transparent_70%)]" />

      {/* Film grain */}
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] h-full w-full"
        style={{ opacity: 0.12, mixBlendMode: "overlay" }}
      >
        <defs>
          <filter id="wt-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#wt-grain)" />
      </svg>

      {/* Exit overlay — sweeps to black */}
      <div
        className="pointer-events-none fixed inset-0 z-50 bg-[#060606] transition-opacity"
        style={{
          opacity: isExit ? 1 : 0,
          transitionDuration: isExit ? "480ms" : "0ms",
          transitionTimingFunction: "cubic-bezier(0.4,0,1,1)",
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center gap-0 text-center"
        style={{
          opacity: isExit ? 0 : 1,
          transition: isExit ? "opacity 350ms ease" : "none",
        }}
      >
        {/* Film icon with pulse ring */}
        <div
          className="relative mb-8 flex items-center justify-center"
          style={{
            opacity: phase === "dormant" ? 0 : 1,
            transform: phase === "dormant" ? "scale(0.55) rotate(-18deg)" : "scale(1) rotate(0deg)",
            filter: phase === "dormant" ? "blur(10px)" : "blur(0px)",
            transition: "opacity 600ms cubic-bezier(0.22,1,0.36,1), transform 600ms cubic-bezier(0.22,1,0.36,1), filter 600ms ease",
          }}
        >
          {/* Expanding pulse ring */}
          {(phase === "icon" || phase === "line") && (
            <span
              className="absolute h-20 w-20 rounded-full border border-[#d4a853]/30"
              style={{ animation: "wt-pulse-ring 1.4s ease-out forwards" }}
            />
          )}
          {/* Static glow ring */}
          <div className="absolute h-16 w-16 rounded-full bg-[#d4a853]/10 blur-xl" />
          {/* Icon container */}
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10 shadow-[0_0_40px_rgba(212,168,83,0.25)]">
            <Film className="h-7 w-7 text-[#d4a853]" />
          </div>
        </div>

        {/* Gold line */}
        <div
          className="mb-9 h-px bg-gradient-to-r from-transparent via-[#d4a853] to-transparent"
          style={{
            width: (phase === "dormant" || phase === "icon") ? "0px" : "120px",
            opacity: (phase === "dormant" || phase === "icon") ? 0 : 1,
            transition: "width 550ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease",
          }}
        />

        {/* Headline */}
        <div
          style={{
            opacity: phase === "dormant" || phase === "icon" || phase === "line" ? 0 : 1,
            transform: (phase === "dormant" || phase === "icon" || phase === "line")
              ? "translateY(36px)"
              : "translateY(0)",
            filter: (phase === "dormant" || phase === "icon" || phase === "line")
              ? "blur(8px)"
              : "blur(0px)",
            transition: "opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1), filter 600ms ease",
          }}
        >
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]">
            You&apos;re in.
          </p>
          <h1
            className="font-display text-4xl font-bold leading-[1.12] tracking-tight text-foreground sm:text-5xl md:text-6xl"
            style={{ maxWidth: "660px" }}
          >
            finally, you can
            <br />
            <span className="text-gradient-gold">ease your mind.</span>
          </h1>
        </div>

        {/* Wordmark */}
        <div
          className="mt-12 flex flex-col items-center gap-3"
          style={{
            opacity: phase === "wordmark" || phase === "hold" ? 1 : 0,
            transform: phase === "wordmark" || phase === "hold" ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 600ms ease, transform 600ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div className="h-px w-12 bg-[#d4a853]/30" />
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.45em] text-[#d4a853]/60">
            CINEFLOW
          </p>
        </div>
      </div>
    </div>
  );
}
