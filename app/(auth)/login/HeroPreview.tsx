"use client";

import { Film } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const features = [
  {
    title: "Storyboard",
    description: "Plan scenes visually with drag-and-drop boards.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" className="text-[#d4a853]" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="7" width="24" height="18" rx="4" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" />
        <rect x="8.5" y="11.5" width="7" height="5" rx="1.5" fill="currentColor" fillOpacity="0.18" />
        <rect x="17.5" y="11.5" width="6" height="2" rx="1" fill="currentColor" fillOpacity="0.18" />
        <rect x="17.5" y="16.5" width="6" height="2" rx="1" fill="currentColor" fillOpacity="0.18" />
      </svg>
    ),
  },
  {
    title: "Revisions",
    description: "Mark up cuts, add notes, and track every change.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" className="text-[#d4a853]" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="7" width="24" height="18" rx="4" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" />
        <rect x="8" y="19" width="16" height="2" rx="1" fill="currentColor" fillOpacity="0.18" />
        <circle cx="12" cy="20" r="1.5" fill="currentColor" />
        <circle cx="20" cy="20" r="1.5" fill="currentColor" />
        <rect x="8" y="13" width="16" height="2" rx="1" fill="currentColor" fillOpacity="0.18" />
        <rect x="8" y="16" width="10" height="1.5" rx="0.75" fill="currentColor" fillOpacity="0.18" />
      </svg>
    ),
  },
  {
    title: "Client Hub",
    description: "Share, review, and get approvals in one place.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" className="text-[#d4a853]" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="7" width="24" height="18" rx="4" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 18l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// Precomputed static values to avoid SSR/client hydration mismatch
const DNA_STRAND_A = Array.from({ length: 12 }, (_, i) => ({
  cx: 60 + 25 * i,
  cy: parseFloat((60 + 300 * Math.abs(Math.sin(i / 2))).toFixed(4)),
  o: parseFloat((0.12 + 0.08 * Math.abs(Math.cos(i))).toFixed(4)),
}));
const DNA_STRAND_B = Array.from({ length: 12 }, (_, i) => ({
  cx: 60 + 25 * i,
  cy: parseFloat((360 - 300 * Math.abs(Math.sin(i / 2))).toFixed(4)),
  o: parseFloat((0.12 + 0.08 * Math.abs(Math.sin(i))).toFixed(4)),
}));

type Particle = {
  x: number; y: number; vx: number; vy: number;
  r: number; gold: boolean; o: number;
};

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    particles.current = Array.from({ length: 80 }, () => ({
      x: Math.random() * parent.clientWidth,
      y: Math.random() * parent.clientHeight,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: 0.9 + Math.random() * 1.6,
      gold: Math.random() < 0.22,
      o: 0.07 + Math.random() * 0.18,
    }));

    const REPEL_RADIUS = 110;
    const ATTRACT_RADIUS = 260;
    const CONNECT_DIST = 90;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { x: mx, y: my } = mouse.current;
      const pts = particles.current;

      for (const p of pts) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < REPEL_RADIUS && dist > 0) {
          // Strong repulsion near cursor
          const force = ((REPEL_RADIUS - dist) / REPEL_RADIUS) * 1.1;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        } else if (dist < ATTRACT_RADIUS && dist > REPEL_RADIUS) {
          // Gentle attraction in the mid-field — particles drift toward cursor
          const force = ((ATTRACT_RADIUS - dist) / ATTRACT_RADIUS) * 0.12;
          p.vx -= (dx / dist) * force;
          p.vy -= (dy / dist) * force;
        }

        p.vx *= 0.96;
        p.vy *= 0.96;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 3.5) { p.vx = (p.vx / speed) * 3.5; p.vy = (p.vy / speed) * 3.5; }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;
      }

      // Connection lines between nearby particles
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT_DIST) {
            const alpha = (1 - d / CONNECT_DIST) * 0.12;
            const isGold = pts[i].gold || pts[j].gold;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = isGold
              ? `rgba(212,168,83,${alpha})`
              : `rgba(229,231,235,${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      // Draw particles on top of lines
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? `rgba(212,168,83,${p.o})` : `rgba(229,231,235,${p.o})`;
        ctx.fill();
      }

      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };

    parent.addEventListener("mousemove", onMove);
    parent.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
      parent.removeEventListener("mousemove", onMove);
      parent.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
}

function DNASpinner() {
  return (
    <svg
      className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 opacity-20 blur-[2px] animate-spin-slow"
      width="500" height="500" viewBox="0 0 420 420" fill="none"
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="dnaA" x1="0" y1="0" x2="420" y2="420" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e5e7eb" stopOpacity="0.18" />
          <stop offset="1" stopColor="#e5e7eb" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="dnaB" x1="420" y1="0" x2="0" y2="420" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e5e7eb" stopOpacity="0.12" />
          <stop offset="1" stopColor="#e5e7eb" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d="M60,60 Q210,210 360,60" stroke="url(#dnaA)" strokeWidth="6" fill="none" />
      <path d="M60,360 Q210,210 360,360" stroke="url(#dnaB)" strokeWidth="6" fill="none" />
      {DNA_STRAND_A.map((pt, i) => (
        <ellipse key={i} cx={pt.cx} cy={pt.cy} rx="10" ry="3" fill="#e5e7eb" fillOpacity={pt.o} />
      ))}
      {DNA_STRAND_B.map((pt, i) => (
        <ellipse key={i + 20} cx={pt.cx} cy={pt.cy} rx="10" ry="3" fill="#e5e7eb" fillOpacity={pt.o} />
      ))}
    </svg>
  );
}

export function HeroPreview() {
  const [phase, setPhase] = useState<"intro" | "transitioning" | "done">("intro");

  useEffect(() => {
    const transition = setTimeout(() => setPhase("transitioning"), 1800);
    const done       = setTimeout(() => setPhase("done"),          2950);
    return () => { clearTimeout(transition); clearTimeout(done); };
  }, []);

  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d0d0d]/95 p-10 shadow-2xl shadow-black/40 ring-1 ring-white/5 w-full max-w-2xl transition duration-300 ease-out hover:shadow-[0_36px_90px_rgba(0,0,0,0.45)]">
      <ParticleField />
      <DNASpinner />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(212,168,83,0.14),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.05),transparent_40%)]" />

      {/* ── Intro overlay ── */}
      {phase !== "done" && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[2rem] bg-[#0d0d0d]"
          style={{
            transition: "opacity 1100ms cubic-bezier(0.4,0,0.2,1)",
            opacity: phase === "transitioning" ? 0 : 1,
            pointerEvents: phase === "transitioning" ? "none" : "auto",
          }}
        >
          <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(212,168,83,0.12),transparent_60%)]" />

          {/* Whole intro block shrinks + drifts upward with motion blur */}
          <div
            className="relative flex flex-col items-center gap-5 select-none"
            style={
              phase === "transitioning"
                ? { animation: "cf-into-badge 1050ms cubic-bezier(0.4,0,0.8,0.2) forwards" }
                : undefined
            }
          >
            <div style={{ animation: "cf-icon-spin-in 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}>
              <Film className="h-10 w-10 text-[#d4a853]" strokeWidth={2} />
            </div>
            <p
              className="text-xs font-bold tracking-[0.45em] text-[#d4a853]/70 uppercase"
              style={{ animation: "cf-fade-up 0.6s ease 0.4s both" }}
            >
              Welcome to
            </p>
            <h2
              className="font-display text-6xl md:text-7xl font-extrabold tracking-tight text-foreground leading-none"
              style={{ animation: "cf-scale-in 0.75s cubic-bezier(0.22,1,0.36,1) 0.65s both" }}
            >
              CineFlow
            </h2>
            <div
              className="h-px bg-gradient-to-r from-transparent via-[#d4a853] to-transparent"
              style={{ animation: "cf-line-expand 0.9s ease 1.1s both" }}
            />
            <p
              className="text-sm text-muted-foreground tracking-wide"
              style={{ animation: "cf-fade-up 0.6s ease 1.35s both" }}
            >
              Studio flow for every production.
            </p>
          </div>
        </div>
      )}

      {/* ── Main content — rises up as intro dissolves above it ── */}
      <div
        className="relative z-10 flex flex-col items-center text-center gap-5"
        style={{
          transition: "opacity 900ms ease 150ms, transform 900ms cubic-bezier(0.22,1,0.36,1) 150ms",
          opacity:   phase === "intro" ? 0 : 1,
          transform: phase === "intro" ? "translateY(14px)" : "translateY(0)",
        }}
      >
        {/* Brand badge — softly emerges right where the shrinking text converges */}
        <div
          className="flex items-center gap-2"
          style={
            phase !== "intro"
              ? { animation: "cf-badge-emerge 0.65s cubic-bezier(0.22,1,0.36,1) 100ms both" }
              : undefined
          }
        >
          <Film className="h-5 w-5 text-[#d4a853]" strokeWidth={2.2} />
          <span className="text-xs font-bold tracking-[0.3em] text-[#d4a853] uppercase">CineFlow</span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-5xl md:text-[3.75rem] font-extrabold leading-[1.04] tracking-tight text-foreground max-w-xl">
          Studio flow for every production.
        </h1>

        {/* Subheadline */}
        <div className="flex flex-col items-center gap-2 w-full max-w-xl">
          <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[#d4a853]/80 uppercase text-center whitespace-nowrap">
            For filmmakers, directors, producers and creative teams
          </p>
          <p className="text-base text-muted-foreground leading-relaxed text-center">
            Launch faster, keep feedback organized, and deliver polished work all in one place.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="mt-5 grid w-full grid-cols-3 gap-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group/card flex flex-col items-center gap-2.5 rounded-2xl border border-[#d4a853]/20 bg-gradient-to-b from-[#171108]/90 to-[#0d0d0d]/95 p-5 shadow-[0_6px_24px_rgba(0,0,0,0.3)] backdrop-blur-md hover:scale-[1.04] hover:border-[#d4a853]/40 hover:shadow-[0_8px_32px_rgba(212,168,83,0.1)] transition-all duration-200"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-[#d4a853]/10 border border-[#d4a853]/20 group-hover/card:bg-[#d4a853]/20 group-hover/card:shadow-[0_0_18px_4px_rgba(212,168,83,0.35)] group-hover/card:border-[#d4a853]/50 transition-all duration-300">
                {feature.icon}
              </div>
              <p className="font-semibold text-sm text-foreground tracking-tight">{feature.title}</p>
              <p className="text-[0.7rem] text-muted-foreground leading-snug">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
