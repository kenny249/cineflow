"use client";

import React, { useEffect, useRef, useState } from "react";
import { Film, Layers, Eye, Users } from "lucide-react";
import { getOrCreateDisplayName, setDisplayName, generateDisplayName } from "@/lib/random-name";
import { createClient } from "@/lib/supabase/client";

type WPt = { x: number; y: number; vx: number; vy: number; r: number; gold: boolean; o: number };

// Interactive cursor-reactive particles with DNA-like connections (matches login page)
function InteractiveParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse     = useRef({ x: -9999, y: -9999 });
  const particles = useRef<WPt[]>([]);
  const raf       = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    particles.current = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 0.7 + Math.random() * 1.4,
      gold: Math.random() < 0.22,
      o: 0.04 + Math.random() * 0.1,
    }));

    const REPEL = 110, ATTRACT = 260, CONNECT = 110;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { x: mx, y: my } = mouse.current;

      if (mx > -500) {
        const outer = ctx.createRadialGradient(mx, my, 0, mx, my, 320);
        outer.addColorStop(0, "rgba(212,168,83,0.028)");
        outer.addColorStop(0.45, "rgba(212,168,83,0.009)");
        outer.addColorStop(1, "rgba(212,168,83,0)");
        ctx.fillStyle = outer;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const inner = ctx.createRadialGradient(mx, my, 0, mx, my, 72);
        inner.addColorStop(0, "rgba(255,245,210,0.04)");
        inner.addColorStop(1, "rgba(255,245,210,0)");
        ctx.fillStyle = inner;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const pts = particles.current;
      for (const p of pts) {
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPEL && dist > 0) {
          const f = ((REPEL - dist) / REPEL) * 0.6;
          p.vx += (dx / dist) * f; p.vy += (dy / dist) * f;
        } else if (dist < ATTRACT && dist > REPEL) {
          const f = ((ATTRACT - dist) / (ATTRACT - REPEL)) * 0.07;
          p.vx -= (dx / dist) * f; p.vy -= (dy / dist) * f;
        }
        p.vx *= 0.972; p.vy *= 0.972;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 2) { p.vx = (p.vx / spd) * 2; p.vy = (p.vy / spd) * 2; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = canvas.width + 10; if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10; if (p.y > canvas.height + 10) p.y = -10;
      }

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT) {
            const alpha = (1 - d / CONNECT) * 0.08;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = (pts[i].gold || pts[j].gold) ? `rgba(212,168,83,${alpha})` : `rgba(229,231,235,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? `rgba(212,168,83,${p.o})` : `rgba(229,231,235,${p.o})`;
        ctx.fill();
      }

      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);

    const onMove  = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}

const FEATURES = [
  {
    icon: Layers,
    eyebrow: "Projects & Shot Lists",
    headline: "Every production,\norganized.",
    sub: "From pre-prod to delivery: schedules, shot lists, and crew all in one place.",
  },
  {
    icon: Eye,
    eyebrow: "Revisions & Feedback",
    headline: "Share cuts.\nCapture notes.",
    sub: "Frame-accurate comments, approval tracking, and a clean revision history.",
  },
  {
    icon: Users,
    eyebrow: "Client Hub",
    headline: "A portal your\nclients will love.",
    sub: "Professional review pages. No logins, no confusion, just feedback.",
  },
] as const;

const FEATURE_BTNS = ["Action", "Scene", "Wrap"] as const;

function FeatureSlide({
  idx,
  total,
  onNext,
}: {
  idx: number;
  total: number;
  onNext: () => void;
}) {
  const feature  = FEATURES[idx];
  const Icon     = feature.icon;
  const cardRef  = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt]             = useState({ x: 0, y: 0 });
  const [btnShift, setBtnShift]     = useState({ x: 0, y: 0 });
  const [showRipple, setShowRipple] = useState(false);
  const [rippleKey, setRippleKey]   = useState(0);
  const pending = useRef(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const r  = card.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const nx = (e.clientX - cx) / (r.width  / 2);
    const ny = (e.clientY - cy) / (r.height / 2);
    setTilt({ x: -ny * 7, y: nx * 7 });
    const btn = btnRef.current;
    if (btn) {
      const br   = btn.getBoundingClientRect();
      const bdx  = e.clientX - (br.left + br.width  / 2);
      const bdy  = e.clientY - (br.top  + br.height / 2);
      const dist = Math.sqrt(bdx * bdx + bdy * bdy);
      setBtnShift(dist < 90 ? { x: bdx * 0.38, y: bdy * 0.38 } : { x: 0, y: 0 });
    }
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setBtnShift({ x: 0, y: 0 });
  };

  const handleNext = () => {
    if (pending.current) return;
    pending.current = true;
    setRippleKey(k => k + 1);
    setShowRipple(true);
    setTimeout(() => setShowRipple(false), 700);
    setTimeout(() => { pending.current = false; onNext(); }, 160);
  };

  const progress = (idx + 1) / total;
  const btnLabel = FEATURE_BTNS[idx] ?? "Next";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col items-center"
      style={{
        transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: "transform 150ms ease-out",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Icon with scan line + pulse rings */}
      <div
        className="relative mb-6 flex items-center justify-center"
        style={{ animation: "wt-feature-in 500ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="absolute h-24 w-24 rounded-full border border-[#d4a853]/15" style={{ animation: "wt-pulse-ring 2.4s ease-out infinite" }} />
        <div className="absolute h-24 w-24 rounded-full border border-[#d4a853]/[0.08]" style={{ animation: "wt-pulse-ring 2.4s ease-out 0.9s infinite" }} />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4a853]/40 bg-[#d4a853]/10 shadow-[0_0_60px_rgba(212,168,83,0.3)]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div
              className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4a853]/70 to-transparent"
              style={{ animation: "wt-scan 2.5s linear infinite" }}
            />
          </div>
          <Icon className="relative z-10 h-8 w-8 text-[#d4a853]" />
        </div>
      </div>

      {/* Eyebrow */}
      <p
        className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]"
        style={{ animation: "wt-feature-in 500ms 80ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {feature.eyebrow}
      </p>

      {/* Headline */}
      <h3
        className="mb-3 font-display text-3xl font-bold leading-tight text-white sm:text-4xl"
        style={{ whiteSpace: "pre-line", animation: "wt-feature-in 500ms 180ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {feature.headline}
      </h3>

      {/* Sub */}
      <p
        className="max-w-xs text-sm leading-relaxed text-zinc-400"
        style={{ animation: "wt-feature-in 500ms 300ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {feature.sub}
      </p>

      {/* Cinematic progress bar */}
      <div
        className="relative mt-8 h-px w-48 overflow-hidden rounded-full bg-white/[0.07]"
        style={{ animation: "wt-feature-in 400ms 420ms ease both" }}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#d4a853]/60 to-[#d4a853]"
          style={{ width: `${progress * 100}%`, transition: "width 600ms cubic-bezier(0.22,1,0.36,1)" }}
        />
        <div
          className="absolute inset-y-0 w-8 rounded-full"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,245,210,0.5), transparent)",
            left: `calc(${progress * 100}% - 16px)`,
            transition: "left 600ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>
      <p
        className="mt-2 text-[0.5rem] font-bold uppercase tracking-[0.4em] text-zinc-600"
        style={{ animation: "wt-feature-in 400ms 460ms ease both" }}
      >
        {idx + 1} of {total}
      </p>

      {/* Magnetic Next button with ripple */}
      <div
        className="mt-8"
        style={{
          transform: `translate(${btnShift.x}px, ${btnShift.y}px)`,
          transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1)",
          animation: "wt-feature-in 500ms 540ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        <button
          ref={btnRef}
          onClick={handleNext}
          className="group relative overflow-hidden rounded-full border border-[#d4a853]/30 bg-[#d4a853]/[0.08] px-8 py-3 text-[0.65rem] font-bold uppercase tracking-[0.35em] text-[#d4a853] backdrop-blur-sm transition-all duration-200 hover:border-[#d4a853]/70 hover:bg-[#d4a853]/[0.18] hover:shadow-[0_0_30px_rgba(212,168,83,0.25)] active:scale-95"
        >
          {showRipple && (
            <span
              key={rippleKey}
              className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 rounded-full bg-[#d4a853]/20"
              style={{ animation: "wt-ripple 700ms ease-out forwards" }}
            />
          )}
          <span className="relative z-10">{btnLabel} →</span>
        </button>
      </div>
    </div>
  );
}

type Phase =
  | "dormant"
  | "logo"
  | "name_ask"
  | "name_ack"
  | "features"
  | "headline"
  | "exit"
  | "gone";

export default function WelcomePage() {
  const [phase, setPhase]         = useState<Phase>("dormant");
  const [nameInput, setNameInput] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [featureIdx, setFeatureIdx] = useState(0);
  const inputRef      = useRef<HTMLInputElement>(null);
  const isReturning   = useRef(false);
  const autoTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Boot sequence
  useEffect(() => {
    isReturning.current = Boolean(localStorage.getItem("cf_onboarded"));
    const name = getOrCreateDisplayName();

    if (isReturning.current) {
      setResolvedName(name);
      const t1 = setTimeout(() => setPhase("logo"),     120);
      const t2 = setTimeout(() => setPhase("headline"), 980);
    const t3 = setTimeout(() => {
      setPhase("exit");
      setTimeout(() => window.location.assign("/dashboard"), 350);
    }, 2400);
      return () => [t1, t2, t3].forEach(clearTimeout);
    } else {
      const t1 = setTimeout(() => setPhase("logo"),     120);
      const t2 = setTimeout(() => {
        setPhase("name_ask");
        setTimeout(() => inputRef.current?.focus(), 80);
      }, 1050);
      return () => [t1, t2].forEach(clearTimeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function advanceFromName(raw: string) {
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
    const final = raw.trim() || generateDisplayName();
    setDisplayName(final);
    setResolvedName(final);
    setPhase("name_ack");

    // Persist name to Supabase profile (fire-and-forget)
    const supabase = createClient();
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .upsert({ id: user.id, full_name: final, updated_at: new Date().toISOString() }, { onConflict: "id" });
        }
      } catch { /* fire-and-forget */ }
    })();

    setTimeout(() => { setPhase("features"); setFeatureIdx(0); }, 1800);
  }

  // Director's "Cut" — skip straight to dashboard
  function handleCut() {
    if (phase === "exit" || phase === "gone") return;
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
    setPhase("exit");
    localStorage.setItem("cf_onboarded", "1");
    localStorage.setItem("cf_onboarded_v3", "1"); // dismiss AppLayout's OnboardingIntro
    setTimeout(() => window.location.assign("/dashboard"), 350);
  }

  // Click background to advance (features phase handled by manual buttons)
  function handleBgClick() {
    if (phase === "dormant" || phase === "name_ask" || phase === "features" || phase === "exit" || phase === "gone") return;
    if (phase === "logo") return;
    if (phase === "name_ack") { setPhase("features"); setFeatureIdx(0); return; }
    if (phase === "headline") handleCut();
  }

  function handleFeatureNext() {
    if (featureIdx < FEATURES.length - 1) {
      setFeatureIdx(i => i + 1);
    } else {
      setPhase("headline");
    }
  }

  // Exit after headline
  useEffect(() => {
    if (phase !== "headline") return;
    const t1 = setTimeout(() => {
      setPhase("exit");
      localStorage.setItem("cf_onboarded", "1");
      localStorage.setItem("cf_onboarded_v3", "1"); // dismiss AppLayout's OnboardingIntro
      // Navigate as the black overlay starts — it IS the transition
      setTimeout(() => window.location.assign("/dashboard"), 350);
    }, 1900);
    return () => clearTimeout(t1);
  }, [phase]);

  const isExit    = phase === "exit" || phase === "gone";
  const firstName = resolvedName.split(" ")[0] ?? resolvedName;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060606]" onClick={handleBgClick}>
      <InteractiveParticles />

      {/* ─── "Cut" — one-word film skip button ─── */}
      <button
        onClick={(e) => { e.stopPropagation(); handleCut(); }}
        style={{
          opacity: phase !== "dormant" && !isExit ? 1 : 0,
          pointerEvents: phase !== "dormant" && !isExit ? "auto" : "none",
          transition: "opacity 600ms ease 800ms",
        }}
        className="fixed right-5 top-5 z-40 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/20 px-4 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-zinc-500 backdrop-blur-sm hover:border-[#d4a853]/40 hover:text-[#d4a853] transition-colors duration-200"
      >
        <Film className="h-2.5 w-2.5" />
        Skip Intro
      </button>

      {/* Radial ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,rgba(212,168,83,0.07)_0%,transparent_70%)]" />

      {/* Film grain */}
      <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1] h-full w-full" style={{ opacity: 0.12, mixBlendMode: "overlay" }}>
        <defs>
          <filter id="wt-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#wt-grain)" />
      </svg>

      {/* Exit overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 bg-[#060606] transition-opacity"
        style={{ opacity: isExit ? 1 : 0, transitionDuration: isExit ? "480ms" : "0ms", transitionTimingFunction: "cubic-bezier(0.4,0,1,1)" }}
      />

      {/* ── LOGO (shown in all phases except dormant) ── */}
      <div
        className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-5"
        style={{
          opacity: phase === "dormant" || phase === "name_ask" || phase === "name_ack" || phase === "features" ? 0 : 1,
          pointerEvents: "none",
          transition: "opacity 500ms ease",
        }}
      >
        {/* Film icon */}
        <div
          style={{
            opacity: phase === "dormant" ? 0 : 1,
            transform: phase === "dormant" ? "scale(0.55) rotate(-18deg)" : "scale(1) rotate(0deg)",
            filter: phase === "dormant" ? "blur(10px)" : "blur(0px)",
            transition: "opacity 600ms cubic-bezier(0.22,1,0.36,1), transform 600ms cubic-bezier(0.22,1,0.36,1), filter 600ms ease",
          }}
          className="relative flex items-center justify-center"
        >
          <div className="absolute h-16 w-16 rounded-full bg-[#d4a853]/10 blur-xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10 shadow-[0_0_40px_rgba(212,168,83,0.25)]">
            <Film className="h-7 w-7 text-[#d4a853]" />
          </div>
        </div>

        {/* Gold line */}
        <div
          className="h-px bg-gradient-to-r from-transparent via-[#d4a853] to-transparent"
          style={{
            width: phase === "dormant" || phase === "logo" ? "0px" : "100px",
            opacity: phase === "dormant" || phase === "logo" ? 0 : 1,
            transition: "width 550ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease",
          }}
        />

        {/* Headline — returning user OR "finally" */}
        <div
          style={{
            opacity: phase === "headline" ? 1 : 0,
            transform: phase === "headline" ? "translateY(0)" : "translateY(24px)",
            filter: phase === "headline" ? "blur(0px)" : "blur(8px)",
            transition: "opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1), filter 600ms ease",
          }}
          className="text-center"
        >
          {isReturning.current ? (
            <>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]">Welcome back.</p>
              <h1 className="font-display text-4xl font-bold leading-[1.12] tracking-tight text-foreground sm:text-5xl">
                Good to see you,<br />
                <span className="text-gradient-gold">{firstName}.</span>
              </h1>
            </>
          ) : (
            <>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]">Your studio awaits.</p>
              <h1 className="font-display text-4xl font-bold leading-[1.12] tracking-tight text-foreground sm:text-5xl">
                finally, you can<br />
                <span className="text-gradient-gold">ease your mind.</span>
              </h1>
            </>
          )}
        </div>

        {/* Wordmark */}
        <div
          className="mt-2 flex flex-col items-center gap-2"
          style={{
            opacity: phase === "headline" ? 1 : 0,
            transform: phase === "headline" ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 600ms ease 300ms, transform 600ms cubic-bezier(0.22,1,0.36,1) 300ms",
          }}
        >
          <div className="h-px w-10 bg-[#d4a853]/30" />
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.45em] text-[#d4a853]/60">CINEFLOW</p>
        </div>
      </div>

      {/* ── NAME ASK ── */}
      <div
        className="relative z-20 flex w-full max-w-sm flex-col items-center px-6 text-center"
        style={{
          opacity: phase === "name_ask" ? 1 : 0,
          transform: phase === "name_ask" ? "translateY(0)" : "translateY(32px)",
          filter: phase === "name_ask" ? "blur(0px)" : "blur(6px)",
          pointerEvents: phase === "name_ask" ? "auto" : "none",
          transition: "opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1), filter 600ms ease",
        }}
      >
        <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10 shadow-[0_0_40px_rgba(212,168,83,0.2)]">
          <Film className="h-7 w-7 text-[#d4a853]" />
        </div>
        <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]">CineFlow Beta</p>
        <h2 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          What should we<br />call you?
        </h2>
        <p className="mb-7 text-sm text-zinc-500">We&apos;ll personalise your studio experience.</p>
        <div className="relative w-full">
          <input
            ref={inputRef}
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && nameInput.trim()) advanceFromName(nameInput); }}
            placeholder="Your name"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={40}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-center text-lg text-white placeholder:text-zinc-500 focus:border-[#d4a853]/50 focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,168,83,0.12)] transition-all"
          />
        </div>
        <div className="mt-4 flex w-full gap-3">
          <button
            onClick={() => advanceFromName(nameInput)}
            disabled={!nameInput.trim()}
            className="flex-1 rounded-2xl bg-[#d4a853] py-3.5 text-sm font-bold text-black hover:bg-[#e0b55e] disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            Let&apos;s go →
          </button>
          <button
            onClick={() => advanceFromName("")}
            className="rounded-2xl border border-white/10 px-4 py-3.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>

      {/* ── NAME ACK ── */}
      <div
        className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center text-center px-6"
        style={{
          opacity: phase === "name_ack" ? 1 : 0,
          transform: phase === "name_ack" ? "translateY(0)" : "translateY(20px)",
          filter: phase === "name_ack" ? "blur(0px)" : "blur(8px)",
          transition: "opacity 600ms cubic-bezier(0.22,1,0.36,1), transform 600ms cubic-bezier(0.22,1,0.36,1), filter 500ms ease",
        }}
      >
        <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]">Welcome to the team.</p>
        <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
          Nice to meet you,<br />
          <span className="text-gradient-gold">{firstName}.</span>
        </h2>
      </div>

      {/* ── FEATURES ── */}
      <div
        className="fixed inset-0 z-20 flex flex-col items-center justify-center text-center px-8"
        style={{
          opacity: phase === "features" ? 1 : 0,
          pointerEvents: phase === "features" ? "auto" : "none",
          transition: "opacity 600ms ease",
        }}
      >
        <FeatureSlide
          key={featureIdx}
          idx={featureIdx}
          total={FEATURES.length}
          onNext={handleFeatureNext}
        />
      </div>

      <style>{`
        @keyframes wt-feature-in {
          from { opacity: 0; transform: translateY(28px) scale(0.97); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    filter: blur(0);  }
        }
        @keyframes wt-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.4; }
          100% { transform: scale(2.0); opacity: 0;   }
        }
        @keyframes wt-scan {
          0%   { top: 0%;   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes wt-ripple {
          from { transform: translate(-50%, -50%) scale(0); opacity: 0.7; }
          to   { transform: translate(-50%, -50%) scale(5); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
