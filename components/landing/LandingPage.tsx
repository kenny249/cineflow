"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { ChaosCanvas } from "./ChaosCanvas";
import { SpotlightCanvas } from "./SpotlightCanvas";

interface Props { refCode?: string }

const PAIN_POINTS = [
  "Shot lists buried in email threads.",
  "Invoices chased for 60 days.",
  'Clients texting "where are we at?" at 11pm.',
];

const PANELS = [
  {
    label: "Every project. Every status. One view.",
    sub: "From brief to delivery — your entire pipeline visible at a glance. No more hunting through Notion or spreadsheets.",
    tag: "Dashboard",
  },
  {
    label: "Your whole crew. Fully in the loop.",
    sub: "Invite collaborators with one click. Set call times, share shot lists, send schedule updates automatically.",
    tag: "Collaboration",
  },
  {
    label: "Get paid. Get approved. Move on.",
    sub: "Professional invoices, client review portals, and digital approvals — all inside the same tab you already have open.",
    tag: "Clients & Finance",
  },
];

function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const h = () => setY(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return y;
}

export function LandingPage({ refCode }: Props) {
  const scrollY = useScrollY();
  const chaosRef = useRef<HTMLDivElement>(null);
  const painRef = useRef<HTMLDivElement>(null);
  const explodeRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const [chaosProgress, setChaosProgress] = useState(0);
  const [explode, setExplode] = useState(false);
  const [painVisible, setPainVisible] = useState<boolean[]>([false, false, false]);
  const [introVisible, setIntroVisible] = useState(false);
  const [goldLineWidth, setGoldLineWidth] = useState(0);
  const [activePanel, setActivePanel] = useState(0);
  const [ctaVisible, setCtaVisible] = useState(false);

  const getProgress = useCallback((el: HTMLElement | null) => {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    return Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height)));
  }, []);

  useEffect(() => {
    // Chaos section progress
    if (chaosRef.current) {
      const rect = chaosRef.current.getBoundingClientRect();
      const total = chaosRef.current.offsetHeight;
      const scrolled = -rect.top;
      setChaosProgress(Math.max(0, Math.min(1, scrolled / total)));
    }

    // Explode trigger
    if (explodeRef.current && !explode) {
      const rect = explodeRef.current.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.6) setExplode(true);
    }

    // Pain points
    if (painRef.current) {
      const items = painRef.current.querySelectorAll("[data-pain]");
      items.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.72) {
          setPainVisible((prev) => {
            if (prev[i]) return prev;
            const next = [...prev]; next[i] = true; return next;
          });
        }
      });
    }

    // Intro gold line
    if (introRef.current) {
      const rect = introRef.current.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.8) {
        setIntroVisible(true);
        const p = Math.max(0, Math.min(1, (window.innerHeight * 0.8 - rect.top) / 300));
        setGoldLineWidth(p * 100);
      }
    }

    // Active panel
    if (panelsRef.current) {
      const rect = panelsRef.current.getBoundingClientRect();
      const total = panelsRef.current.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const p = Math.max(0, Math.min(1, scrolled / total));
      setActivePanel(Math.min(PANELS.length - 1, Math.floor(p * PANELS.length)));
    }

    // CTA
    if (ctaRef.current) {
      const rect = ctaRef.current.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9) setCtaVisible(true);
    }
  }, [scrollY, explode, getProgress]);

  const signupHref = refCode ? `/signup?ref=${refCode}` : "/signup";

  return (
    <div className="bg-[#060606] text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Film className="h-3.5 w-3.5 text-[#d4a853]" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">CineFlow</span>
        </div>
        <Link
          href={signupHref}
          className="rounded-lg bg-[#d4a853] px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
        >
          Get early access
        </Link>
      </nav>

      {/* ══════════════════════════════════════════════
          SECTION 1 — CHAOS (sticky scroll container)
      ══════════════════════════════════════════════ */}
      <div ref={chaosRef} className="relative" style={{ height: "300vh" }}>
        <div className="sticky top-0 h-screen overflow-hidden">
          <ChaosCanvas scrollProgress={chaosProgress} explode={false} />

          {/* Headline fades in immediately */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-6 pointer-events-none"
            style={{ opacity: Math.max(0, 1 - chaosProgress * 3) }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#d4a853] mb-6">
              The problem
            </p>
            <h1
              className="text-center font-black leading-none tracking-tight"
              style={{ fontSize: "clamp(2.5rem, 7vw, 6rem)" }}
            >
              The average agency runs<br />
              <span className="text-[#d4a853]">7 different tools</span><br />
              to manage one production.
            </h1>
          </div>

          {/* Chaos intensifies label */}
          <div
            className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none"
            style={{ opacity: Math.min(chaosProgress * 4, 1) * Math.max(0, 1 - (chaosProgress - 0.7) * 5) }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">Scroll to feel the chaos</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 2 — PAIN POINTS
      ══════════════════════════════════════════════ */}
      <div ref={painRef} className="relative bg-[#060606] py-32 px-6">
        <div className="mx-auto max-w-3xl space-y-20">
          {PAIN_POINTS.map((point, i) => (
            <div
              key={i}
              data-pain
              className="overflow-hidden"
              style={{
                opacity: painVisible[i] ? 1 : 0,
                transform: painVisible[i] ? "translateY(0)" : "translateY(40px)",
                transition: "opacity 0.8s ease, transform 0.8s ease",
                transitionDelay: `${i * 0.1}s`,
              }}
            >
              <p
                className="font-black leading-tight text-white/90"
                style={{ fontSize: "clamp(1.8rem, 5vw, 4rem)" }}
              >
                <span className="text-[#d4a853]">"</span>{point}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 3 — THE EXPLOSION
      ══════════════════════════════════════════════ */}
      <div ref={explodeRef} className="relative overflow-hidden bg-[#060606]" style={{ height: "100vh" }}>
        {/* Explosion canvas (full bleed) */}
        <div className="absolute inset-0">
          <ChaosCanvas scrollProgress={1} explode={explode} />
        </div>

        {/* Post-explosion text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-6 pointer-events-none"
          style={{
            opacity: explode ? 1 : 0,
            transition: "opacity 1.2s ease 1.5s",
          }}
        >
          <h2
            className="text-center font-black leading-tight tracking-tight text-white"
            style={{ fontSize: "clamp(2rem, 6vw, 5rem)" }}
          >
            What if you didn't<br />
            <span className="text-[#d4a853]">need any of them?</span>
          </h2>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 4 — INTRODUCTION
      ══════════════════════════════════════════════ */}
      <div ref={introRef} className="relative bg-[#060606] py-40 px-6">
        <div className="mx-auto max-w-4xl">

          {/* Gold line */}
          <div className="mb-12 h-px bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full bg-[#d4a853]"
              style={{
                width: `${goldLineWidth}%`,
                transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)",
              }}
            />
          </div>

          <p
            className="mb-4 text-[11px] font-bold uppercase tracking-[0.35em] text-[#d4a853]"
            style={{
              opacity: introVisible ? 1 : 0,
              transform: introVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s",
            }}
          >
            Introducing
          </p>

          <h2
            className="font-black leading-none tracking-tighter text-white"
            style={{
              fontSize: "clamp(4rem, 12vw, 10rem)",
              opacity: introVisible ? 1 : 0,
              transform: introVisible ? "translateY(0)" : "translateY(30px)",
              transition: "opacity 1s ease 0.5s, transform 1s ease 0.5s",
            }}
          >
            Cine<span className="text-[#d4a853]">Flow</span>
          </h2>

          <p
            className="mt-8 max-w-xl font-medium leading-relaxed text-white/50"
            style={{
              fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
              opacity: introVisible ? 1 : 0,
              transform: introVisible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.8s ease 0.9s, transform 0.8s ease 0.9s",
            }}
          >
            One place. Every project. Total clarity.<br />
            Built for media agencies that are done juggling.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 5 — PRODUCT WALKTHROUGH
      ══════════════════════════════════════════════ */}
      <div ref={panelsRef} className="relative" style={{ height: `${PANELS.length * 100}vh` }}>
        <div className="sticky top-0 h-screen overflow-hidden flex items-center">
          <div className="w-full px-6 sm:px-16">
            <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

              {/* Text side */}
              <div className="space-y-4">
                {/* Panel indicator dots */}
                <div className="flex gap-2 mb-8">
                  {PANELS.map((_, i) => (
                    <div
                      key={i}
                      className="h-1 rounded-full transition-all duration-500"
                      style={{
                        width: activePanel === i ? "2rem" : "0.5rem",
                        background: activePanel === i ? "#d4a853" : "#333",
                      }}
                    />
                  ))}
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d4a853]">
                  {PANELS[activePanel].tag}
                </p>

                <h3
                  className="font-black leading-tight text-white"
                  style={{ fontSize: "clamp(1.8rem, 4vw, 3.5rem)" }}
                >
                  {PANELS[activePanel].label}
                </h3>

                <p className="text-base leading-relaxed text-white/40 max-w-md">
                  {PANELS[activePanel].sub}
                </p>
              </div>

              {/* Visual side — stylized UI mockup */}
              <div
                className="relative"
                style={{
                  perspective: "1000px",
                }}
              >
                <div
                  className="relative rounded-2xl border border-white/[0.06] bg-[#0f0f0f] overflow-hidden shadow-[0_0_80px_rgba(212,168,83,0.08)]"
                  style={{
                    transform: "rotateY(-8deg) rotateX(4deg)",
                    transition: "transform 0.6s ease",
                  }}
                >
                  {/* Mock header */}
                  <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                    <div className="ml-3 h-4 w-48 rounded bg-white/[0.04]" />
                  </div>

                  {/* Mock content varies per panel */}
                  <div className="p-5 space-y-3" style={{ minHeight: "280px" }}>
                    {activePanel === 0 && (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="h-4 w-32 rounded bg-[#d4a853]/20" />
                          <div className="h-6 w-16 rounded-lg bg-[#d4a853]/30" />
                        </div>
                        {["active", "review", "active", "delivered"].map((s, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: s === "active" ? "#34d399" : s === "review" ? "#fbbf24" : "#60a5fa" }} />
                            <div className="h-3 flex-1 rounded bg-white/10" style={{ width: `${60 + i * 10}%` }} />
                            <div className="h-5 w-14 rounded-md bg-white/[0.04]" />
                          </div>
                        ))}
                      </>
                    )}
                    {activePanel === 1 && (
                      <>
                        <div className="mb-4 h-4 w-40 rounded bg-white/10" />
                        {["Director", "1st AD", "DP", "Script Sup"].map((role, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                            <div className="h-7 w-7 rounded-full bg-[#d4a853]/20 flex items-center justify-center text-[10px] font-bold text-[#d4a853]">{role[0]}</div>
                            <div>
                              <div className="h-2.5 w-20 rounded bg-white/20 mb-1" />
                              <div className="h-2 w-14 rounded bg-[#d4a853]/30" />
                            </div>
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </div>
                        ))}
                      </>
                    )}
                    {activePanel === 2 && (
                      <>
                        <div className="mb-4 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[#d4a853]/20" />
                          <div>
                            <div className="h-3 w-28 rounded bg-white/20 mb-1.5" />
                            <div className="h-2 w-20 rounded bg-white/10" />
                          </div>
                          <div className="ml-auto h-7 w-20 rounded-lg bg-[#d4a853]/80" />
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
                          {["Retainer", "Production", "Post-Production"].map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-[#d4a853]/60" />
                              <div className="h-2.5 flex-1 rounded bg-white/10" />
                              <div className="h-3 w-16 rounded bg-white/20 font-mono" />
                            </div>
                          ))}
                          <div className="border-t border-white/[0.06] pt-2 flex justify-between">
                            <div className="h-3 w-12 rounded bg-white/20" />
                            <div className="h-3 w-20 rounded bg-[#d4a853]/40" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Glow */}
                <div className="absolute -inset-4 rounded-3xl bg-[#d4a853]/5 blur-2xl -z-10" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 6 — CTA (SPOTLIGHT)
      ══════════════════════════════════════════════ */}
      <div ref={ctaRef} className="relative h-screen overflow-hidden bg-[#060606] flex flex-col items-center justify-center">
        <SpotlightCanvas />

        <div
          className="relative z-10 flex flex-col items-center gap-8 px-6 text-center"
          style={{
            opacity: ctaVisible ? 1 : 0,
            transform: ctaVisible ? "translateY(0)" : "translateY(30px)",
            transition: "opacity 1s ease, transform 1s ease",
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-[#d4a853]">
            Move your cursor
          </p>

          <h2
            className="font-black leading-tight tracking-tight text-white"
            style={{ fontSize: "clamp(2.5rem, 7vw, 6rem)", textShadow: "0 0 60px rgba(212,168,83,0.2)" }}
          >
            Ready to run your agency<br />
            <span className="text-[#d4a853]">like a director?</span>
          </h2>

          <p className="text-lg text-white/40 max-w-md">
            Join media agencies already using CineFlow to close more projects, pay less subscriptions, and finally feel in control.
          </p>

          <Link
            href={signupHref}
            className="group relative overflow-hidden rounded-2xl bg-[#d4a853] px-10 py-4 text-base font-black text-black transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(212,168,83,0.4)]"
          >
            <span className="relative z-10">Start for free →</span>
          </Link>

          <p className="text-xs text-white/20">No credit card required. Cancel anytime.</p>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 text-[11px] text-white/20">
          <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white/50 transition-colors">Terms</Link>
          <span>© 2026 CineFlow</span>
        </div>
      </div>
    </div>
  );
}
