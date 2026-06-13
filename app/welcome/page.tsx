"use client";

import { useEffect, useRef, useState } from "react";
import { Film, ArrowRight, Check } from "lucide-react";
import { getOrCreateDisplayName, setDisplayName, generateDisplayName } from "@/lib/random-name";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type WPt = { x: number; y: number; vx: number; vy: number; r: number; gold: boolean; o: number };

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

const ROLES = [
  { value: "solo_editor",        label: "Solo Editor",          sub: "You handle everything yourself" },
  { value: "cinematographer",    label: "Cinematographer / DP", sub: "Camera work & visual storytelling" },
  { value: "production_company", label: "Production Company",   sub: "Full-service video production" },
  { value: "agency",             label: "Creative Agency",      sub: "Client-facing studio with a team" },
];

const CONTENT_TYPES = [
  { value: "commercials", label: "Commercials & Branded", sub: "Ad campaigns & brand videos" },
  { value: "weddings",    label: "Weddings & Events",     sub: "Celebrations & live events" },
  { value: "films",       label: "Films & Narrative",     sub: "Short films, docs, features" },
  { value: "corporate",   label: "Corporate",             sub: "Internal & business content" },
  { value: "social",      label: "Social Content",        sub: "YouTube, TikTok, Reels" },
];

const TEAM_SIZES = [
  { value: "just_me",      label: "Just me",      sub: "Solo operation" },
  { value: "small_team",   label: "Small team",   sub: "2–5 people" },
  { value: "growing_team", label: "Growing team", sub: "6+ people" },
];

type Phase = "dormant" | "logo" | "name_ask" | "name_ack" | "setup" | "headline" | "exit" | "gone";

export default function WelcomePage() {
  const [phase, setPhase]               = useState<Phase>("dormant");
  const [nameInput, setNameInput]       = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [setupStep, setSetupStep]       = useState(1);
  const [stepVisible, setStepVisible]   = useState(true);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [selectedTeamSize, setSelectedTeamSize]         = useState<string | null>(null);
  const [usesDrone, setUsesDrone]       = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const isReturning = useRef(false);
  const autoTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    async function boot() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      const validFirst = profile?.first_name && !profile.first_name.includes("@")
        ? profile.first_name : null;
      const profileName = validFirst
        ? [validFirst, profile?.last_name].filter(Boolean).join(" ")
        : null;

      const ret = Boolean(profileName || localStorage.getItem("cf_onboarded"));
      isReturning.current = ret;

      if (ret) {
        const name = profileName ?? getOrCreateDisplayName();
        if (profileName) {
          setDisplayName(profileName);
          localStorage.setItem("cf_onboarded", "1");
        }
        setResolvedName(name);
        timers.push(setTimeout(() => setPhase("logo"),     120));
        timers.push(setTimeout(() => setPhase("headline"), 980));
        timers.push(setTimeout(() => {
          setPhase("exit");
          setTimeout(() => window.location.assign("/dashboard"), 350);
        }, 2400));
      } else {
        timers.push(setTimeout(() => setPhase("logo"), 120));
        timers.push(setTimeout(() => {
          setPhase("name_ask");
          setTimeout(() => inputRef.current?.focus(), 80);
        }, 1050));
      }
    }

    boot();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, []);

  function advanceFromName(raw: string) {
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
    const final = raw.trim() || generateDisplayName();
    setDisplayName(final);
    setResolvedName(final);
    setPhase("name_ack");

    const supabase = createClient();
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const parts = final.split(" ");
          await supabase.from("profiles").upsert({
            id: user.id,
            first_name: parts[0],
            last_name: parts.slice(1).join(" ") || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "id" });
        }
      } catch { /* fire-and-forget */ }
    })();

    setTimeout(() => { setPhase("setup"); setSetupStep(1); setStepVisible(true); }, 1800);
  }

  function handleCut() {
    if (phase === "exit" || phase === "gone") return;
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
    setPhase("exit");
    localStorage.setItem("cf_onboarded", "1");
    setTimeout(() => window.location.assign("/dashboard"), 350);
  }

  function toggleContentType(v: string) {
    setSelectedContentTypes(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  }

  async function handleSetupNext() {
    if (setupStep < 3) {
      setStepVisible(false);
      setTimeout(() => { setSetupStep(s => s + 1); setStepVisible(true); }, 280);
      return;
    }
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          user_role: selectedRole,
          content_types: selectedContentTypes.length > 0 ? selectedContentTypes : null,
          team_size: selectedTeamSize,
          uses_drone: usesDrone,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      }
    } catch { /* fire-and-forget */ }
    setPhase("headline");
  }

  useEffect(() => {
    if (phase !== "headline") return;
    const t = setTimeout(() => {
      setPhase("exit");
      localStorage.setItem("cf_onboarded", "1");
      setTimeout(() => window.location.assign("/dashboard"), 350);
    }, 1900);
    return () => clearTimeout(t);
  }, [phase]);

  function handleBgClick() {
    if (["dormant", "name_ask", "setup", "exit", "gone", "logo"].includes(phase)) return;
    if (phase === "name_ack") { setPhase("setup"); setSetupStep(1); setStepVisible(true); return; }
    if (phase === "headline") handleCut();
  }

  const isExit    = phase === "exit" || phase === "gone";
  const firstName = resolvedName.split(" ")[0] ?? resolvedName;

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060606]"
      onClick={handleBgClick}
    >
      <InteractiveParticles />

      {/* Skip button */}
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
        Skip
      </button>

      {/* Ambient glow */}
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

      {/* ── LOGO + HEADLINE ── */}
      <div
        className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-5"
        style={{
          opacity: phase === "dormant" || phase === "name_ask" || phase === "name_ack" || phase === "setup" ? 0 : 1,
          pointerEvents: "none",
          transition: "opacity 500ms ease",
        }}
      >
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

        <div
          className="h-px bg-gradient-to-r from-transparent via-[#d4a853] to-transparent"
          style={{
            width: phase === "dormant" || phase === "logo" ? "0px" : "100px",
            opacity: phase === "dormant" || phase === "logo" ? 0 : 1,
            transition: "width 550ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease",
          }}
        />

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
        <p className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]">CineFlow</p>
        <h2 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          What should we<br />call you?
        </h2>
        <p className="mb-7 text-sm text-zinc-500">We&apos;ll personalise your studio.</p>
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
        className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
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

      {/* ── SETUP ── */}
      <div
        className="fixed inset-0 z-20 flex flex-col items-center justify-center px-6 overflow-y-auto py-20"
        style={{
          opacity: phase === "setup" ? 1 : 0,
          pointerEvents: phase === "setup" ? "auto" : "none",
          transition: "opacity 600ms ease",
        }}
      >
        {/* Step dots */}
        <div className="flex items-center gap-1.5 mb-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className="rounded-full transition-all duration-500"
              style={{
                width: s === setupStep ? 22 : 5,
                height: 5,
                background: s < setupStep
                  ? "rgba(212,168,83,0.35)"
                  : s === setupStep
                  ? "#d4a853"
                  : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        <div
          className="flex w-full max-w-md flex-col items-center text-center"
          style={{
            opacity: stepVisible ? 1 : 0,
            transform: stepVisible ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 280ms ease, transform 280ms ease",
          }}
        >
          {/* Step 1: Role */}
          {setupStep === 1 && (
            <>
              <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]">Step 1 of 3</p>
              <h2 className="mb-1 text-2xl font-bold text-white">What describes your work?</h2>
              <p className="mb-7 text-sm text-white/40">We&apos;ll set up your workspace to match.</p>
              <div className="grid w-full grid-cols-2 gap-3">
                {ROLES.map(role => (
                  <button
                    key={role.value}
                    onClick={() => setSelectedRole(role.value)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98]",
                      selectedRole === role.value
                        ? "border-[#d4a853]/60 bg-[#d4a853]/[0.10] shadow-[0_0_20px_rgba(212,168,83,0.12)]"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.05]"
                    )}
                  >
                    <p className={cn("mb-0.5 text-sm font-semibold transition-colors", selectedRole === role.value ? "text-[#d4a853]" : "text-white")}>
                      {role.label}
                    </p>
                    <p className="text-[11px] leading-tight text-white/40">{role.sub}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2: Content types (multi-select) */}
          {setupStep === 2 && (
            <>
              <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]">Step 2 of 3</p>
              <h2 className="mb-1 text-2xl font-bold text-white">What content do you create?</h2>
              <p className="mb-7 text-sm text-white/40">Select all that apply.</p>
              <div className="flex w-full flex-wrap justify-center gap-2.5">
                {CONTENT_TYPES.map(ct => {
                  const sel = selectedContentTypes.includes(ct.value);
                  return (
                    <button
                      key={ct.value}
                      onClick={() => toggleContentType(ct.value)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition-all duration-200 active:scale-[0.98]",
                        sel
                          ? "border-[#d4a853]/60 bg-[#d4a853]/[0.10]"
                          : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {sel && <Check className="h-3 w-3 shrink-0 text-[#d4a853]" />}
                        <p className={cn("text-xs font-semibold", sel ? "text-[#d4a853]" : "text-white")}>{ct.label}</p>
                      </div>
                      <p className="mt-0.5 text-[10px] text-white/40">{ct.sub}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 3: Team size + drone */}
          {setupStep === 3 && (
            <>
              <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.35em] text-[#d4a853]">Step 3 of 3</p>
              <h2 className="mb-1 text-2xl font-bold text-white">Last one. How do you work?</h2>
              <p className="mb-7 text-sm text-white/40">This sets up your team tools.</p>
              <div className="mb-4 flex w-full gap-3">
                {TEAM_SIZES.map(ts => (
                  <button
                    key={ts.value}
                    onClick={() => setSelectedTeamSize(ts.value)}
                    className={cn(
                      "flex-1 rounded-2xl border px-3 py-4 text-center transition-all duration-200 active:scale-[0.98]",
                      selectedTeamSize === ts.value
                        ? "border-[#d4a853]/60 bg-[#d4a853]/[0.10]"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.05]"
                    )}
                  >
                    <p className={cn("text-xs font-semibold", selectedTeamSize === ts.value ? "text-[#d4a853]" : "text-white")}>{ts.label}</p>
                    <p className="mt-0.5 text-[10px] text-white/40">{ts.sub}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setUsesDrone(d => !d)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 transition-all duration-200",
                  usesDrone
                    ? "border-[#d4a853]/60 bg-[#d4a853]/[0.08]"
                    : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15]"
                )}
              >
                <div className="text-left">
                  <p className={cn("text-sm font-semibold", usesDrone ? "text-[#d4a853]" : "text-white")}>Do you fly drones?</p>
                  <p className="text-[11px] text-white/40">Enables FAA logs &amp; flight planning tools</p>
                </div>
                <div className={cn("relative h-6 w-11 rounded-full border transition-all", usesDrone ? "border-[#d4a853]/40 bg-[#d4a853]/20" : "border-white/[0.12] bg-white/[0.06]")}>
                  <div className={cn("absolute top-0.5 h-5 w-5 rounded-full transition-all", usesDrone ? "left-5 bg-[#d4a853]" : "left-0.5 bg-white/30")} />
                </div>
              </button>
            </>
          )}

          {/* Continue / Enter */}
          <button
            onClick={handleSetupNext}
            disabled={setupStep === 1 && !selectedRole}
            className="mt-8 flex items-center gap-2.5 rounded-xl bg-[#d4a853] px-8 py-3.5 text-sm font-bold text-black transition-all hover:bg-[#c9a040] hover:shadow-[0_0_28px_rgba(212,168,83,0.3)] active:scale-[0.97] disabled:opacity-40"
          >
            {setupStep === 3 ? "Enter CineFlow" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={handleCut}
            className="mt-4 text-[11px] text-white/25 transition-colors hover:text-white/50"
          >
            Skip setup
          </button>
        </div>
      </div>
    </div>
  );
}
