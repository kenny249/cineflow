"use client";

import { useEffect, useState } from "react";
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
    tag: "Dashboard",
    label: "Every project. Every status. One view.",
    sub: "From brief to delivery — your entire pipeline visible at a glance. No more Notion, no more spreadsheets.",
  },
  {
    tag: "Collaboration",
    label: "Your whole crew. Fully in the loop.",
    sub: "Invite collaborators with one click. Set call times, share shot lists, send schedule updates automatically.",
  },
  {
    tag: "Clients & Finance",
    label: "Get paid. Get approved. Move on.",
    sub: "Professional invoices, client review portals, and digital approvals — all in one place.",
  },
];

export function LandingPage({ refCode }: Props) {
  const [chaosProgress, setChaosProgress] = useState(0);
  const [explode, setExplode] = useState(false);
  const [activePanel, setActivePanel] = useState(0);

  const signupHref = refCode ? `/signup?ref=${refCode}` : "/signup";

  useEffect(() => {
    let kill: (() => void) | undefined;

    (async () => {
      const { default: gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      const { default: Lenis } = await import("lenis");

      gsap.registerPlugin(ScrollTrigger);

      // Smooth scrolling — synced with ScrollTrigger
      const lenis = new Lenis({ lerp: 0.1 });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const ctx = gsap.context(() => {
        // ── Chaos scroll progress ────────────────────────────────────
        ScrollTrigger.create({
          trigger: "#s-chaos",
          start: "top top",
          end: "bottom top",
          onUpdate: (st) => setChaosProgress(st.progress),
        });

        // ── Pain points stagger in ───────────────────────────────────
        gsap.utils.toArray<Element>("[data-pain]").forEach((el) => {
          gsap.fromTo(
            el,
            { y: 48, opacity: 0 },
            {
              y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 83%" },
            }
          );
        });

        // ── Explosion trigger ─────────────────────────────────────────
        ScrollTrigger.create({
          trigger: "#s-explode",
          start: "top 55%",
          onEnter: () => setExplode(true),
        });
        gsap.fromTo(
          "#explode-text",
          { y: 28, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.9,
            scrollTrigger: { trigger: "#s-explode", start: "top 30%" },
          }
        );

        // ── Intro gold line ───────────────────────────────────────────
        gsap.fromTo(
          "#gold-line",
          { scaleX: 0 },
          {
            scaleX: 1, duration: 1.4, ease: "power3.inOut",
            scrollTrigger: { trigger: "#s-intro", start: "top 72%" },
          }
        );
        gsap.utils.toArray<Element>("[data-intro]").forEach((el, i) => {
          gsap.fromTo(
            el,
            { y: 36, opacity: 0 },
            {
              y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
              scrollTrigger: { trigger: "#s-intro", start: "top 62%" },
              delay: 0.25 + i * 0.18,
            }
          );
        });

        // ── Panels scroll progress ────────────────────────────────────
        ScrollTrigger.create({
          trigger: "#s-panels",
          start: "top top",
          end: "bottom top",
          onUpdate: (st) => {
            setActivePanel(
              Math.min(PANELS.length - 1, Math.floor(st.progress * PANELS.length))
            );
          },
        });

        // ── CTA section ───────────────────────────────────────────────
        gsap.utils.toArray<Element>("[data-cta]").forEach((el, i) => {
          gsap.fromTo(
            el,
            { y: 28, opacity: 0 },
            {
              y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
              scrollTrigger: { trigger: "#s-cta", start: "top 72%" },
              delay: i * 0.12,
            }
          );
        });
      });

      kill = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
        ctx.revert();
      };
    })();

    return () => kill?.();
  }, []);

  return (
    <div className="bg-[#060606] text-white">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Film className="h-4 w-4 text-[#d4a853]" />
          </div>
          <span className="text-sm font-bold tracking-tight">CineFlow</span>
        </div>
        <Link
          href={signupHref}
          className="rounded-xl bg-[#d4a853] px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
        >
          Get early access
        </Link>
      </nav>

      {/* ══ S1: CHAOS ════════════════════════════════════════════════ */}
      <div id="s-chaos" className="relative" style={{ height: "280vh" }}>
        <div className="sticky top-0 h-screen overflow-hidden">
          <ChaosCanvas scrollProgress={chaosProgress} explode={false} />

          {/* Headline */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-8 pointer-events-none"
            style={{ opacity: Math.max(0, 1 - chaosProgress * 3.5) }}
          >
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.32em] text-[#d4a853]">
              The problem
            </p>
            <h1
              className="max-w-2xl text-center font-black leading-[1.1] tracking-tight"
              style={{ fontSize: "clamp(1.9rem, 3.4vw, 3rem)" }}
            >
              The average agency runs{" "}
              <span className="text-[#d4a853]">7 different tools</span>{" "}
              to manage one production.
            </h1>
          </div>

          {/* Scroll hint */}
          <div
            className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none"
            style={{ opacity: Math.max(0, 1 - chaosProgress * 9) }}
          >
            <div className="h-8 w-px bg-gradient-to-b from-transparent to-[#d4a853]/30" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-white/20">Scroll</p>
          </div>
        </div>
      </div>

      {/* ══ S2: PAIN POINTS ══════════════════════════════════════════ */}
      <div className="py-32 px-8">
        <div className="mx-auto max-w-xl space-y-16">
          {PAIN_POINTS.map((p, i) => (
            <div key={i} data-pain style={{ opacity: 0 }}>
              <p
                className="font-black leading-snug tracking-tight text-white"
                style={{ fontSize: "clamp(1.45rem, 2.6vw, 2.2rem)" }}
              >
                <span className="text-[#d4a853]">"</span>{p}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ S3: EXPLOSION ════════════════════════════════════════════ */}
      <div id="s-explode" className="relative overflow-hidden" style={{ height: "100vh" }}>
        <div className="absolute inset-0">
          <ChaosCanvas scrollProgress={1} explode={explode} />
        </div>
        <div
          id="explode-text"
          className="absolute inset-0 flex flex-col items-center justify-center px-8 pointer-events-none"
          style={{ opacity: 0 }}
        >
          <h2
            className="max-w-xl text-center font-black leading-tight tracking-tight"
            style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.8rem)" }}
          >
            What if you didn&apos;t{" "}
            <span className="text-[#d4a853]">need any of them?</span>
          </h2>
        </div>
      </div>

      {/* ══ S4: INTRODUCTION ═════════════════════════════════════════ */}
      <div id="s-intro" className="py-36 px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 h-px bg-[#181818] overflow-hidden">
            <div
              id="gold-line"
              className="h-full w-full bg-[#d4a853]"
              style={{ transformOrigin: "left center", transform: "scaleX(0)" }}
            />
          </div>

          <p
            data-intro
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.36em] text-[#d4a853]"
            style={{ opacity: 0 }}
          >
            Introducing
          </p>

          <h2
            data-intro
            className="font-black leading-none tracking-tighter"
            style={{ fontSize: "clamp(3.5rem, 8vw, 7rem)", opacity: 0 }}
          >
            Cine<span className="text-[#d4a853]">Flow</span>
          </h2>

          <p
            data-intro
            className="mt-7 max-w-md text-sm leading-relaxed text-white/40"
            style={{ opacity: 0 }}
          >
            One place. Every project. Total clarity.<br />
            Built for media agencies that are done juggling.
          </p>
        </div>
      </div>

      {/* ══ S5: PRODUCT PANELS (CSS sticky) ═════════════════════════ */}
      <div id="s-panels" className="relative" style={{ height: `${PANELS.length * 100}vh` }}>
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <div className="w-full px-8 sm:px-16">
            <div className="mx-auto max-w-5xl grid md:grid-cols-2 gap-16 items-center">

              {/* Text side */}
              <div className="space-y-4">
                {/* Progress indicators */}
                <div className="flex gap-2 mb-8">
                  {PANELS.map((_, i) => (
                    <div
                      key={i}
                      className="h-0.5 rounded-full transition-all duration-500"
                      style={{
                        width: activePanel === i ? 28 : 8,
                        background: activePanel === i ? "#d4a853" : "#252525",
                      }}
                    />
                  ))}
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d4a853] transition-all duration-500">
                  {PANELS[activePanel].tag}
                </p>
                <h3
                  className="font-black leading-tight text-white transition-all duration-500"
                  style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.2rem)" }}
                >
                  {PANELS[activePanel].label}
                </h3>
                <p className="text-sm leading-relaxed text-white/35 max-w-xs transition-all duration-500">
                  {PANELS[activePanel].sub}
                </p>
              </div>

              {/* Mockup UI */}
              <div className="relative" style={{ perspective: 1200 }}>
                <div
                  className="rounded-2xl border border-white/[0.07] bg-[#0d0d0d] overflow-hidden"
                  style={{
                    transform: "rotateY(-5deg) rotateX(2deg)",
                    boxShadow: "0 0 60px rgba(212,168,83,0.06), 0 24px 48px rgba(0,0,0,0.5)",
                  }}
                >
                  {/* Fake browser chrome */}
                  <div className="border-b border-white/[0.05] px-4 py-2.5 flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-500/40" />
                    <div className="h-2 w-2 rounded-full bg-yellow-500/40" />
                    <div className="h-2 w-2 rounded-full bg-green-500/40" />
                    <div className="ml-3 h-3 w-36 rounded bg-white/[0.04]" />
                  </div>

                  <div className="p-4 space-y-2" style={{ minHeight: 230 }}>

                    {/* Panel 0: Dashboard */}
                    {activePanel === 0 && (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-3 w-24 rounded bg-[#d4a853]/20" />
                          <div className="h-5 w-12 rounded-lg bg-[#d4a853]/20" />
                        </div>
                        {(["active", "review", "active", "delivered"] as const).map((s, i) => (
                          <div key={i} className="flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                            <div
                              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                              style={{ background: s === "active" ? "#34d399" : s === "review" ? "#fbbf24" : "#60a5fa" }}
                            />
                            <div className="h-2 flex-1 rounded bg-white/10" />
                            <div className="h-4 w-10 rounded bg-white/[0.04]" />
                          </div>
                        ))}
                      </>
                    )}

                    {/* Panel 1: Collaboration */}
                    {activePanel === 1 && (
                      <>
                        <div className="mb-3 h-3 w-32 rounded bg-white/10" />
                        {["Director", "1st AD", "DP", "Script Sup"].map((role, i) => (
                          <div key={i} className="flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                            <div className="h-6 w-6 rounded-full bg-[#d4a853]/20 flex items-center justify-center text-[8px] font-bold text-[#d4a853]">
                              {role[0]}
                            </div>
                            <div>
                              <div className="h-2 w-16 rounded bg-white/20 mb-1" />
                              <div className="h-1.5 w-10 rounded bg-[#d4a853]/20" />
                            </div>
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                          </div>
                        ))}
                      </>
                    )}

                    {/* Panel 2: Finance */}
                    {activePanel === 2 && (
                      <>
                        <div className="mb-3 flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-[#d4a853]/20" />
                          <div>
                            <div className="h-2.5 w-20 rounded bg-white/20 mb-1" />
                            <div className="h-1.5 w-16 rounded bg-white/10" />
                          </div>
                          <div className="ml-auto h-6 w-14 rounded-lg bg-[#d4a853]/60 flex items-center justify-center text-[9px] font-bold text-black">
                            Send
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3 space-y-2.5">
                          {["Retainer", "Production", "Post-Production"].map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-[#d4a853]/50" />
                              <div className="h-1.5 flex-1 rounded bg-white/10" />
                              <div className="h-2.5 w-12 rounded bg-white/15" />
                            </div>
                          ))}
                          <div className="border-t border-white/[0.05] pt-2 flex justify-between">
                            <div className="h-2 w-8 rounded bg-white/20" />
                            <div className="h-2 w-14 rounded bg-[#d4a853]/30" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="absolute -inset-8 bg-[#d4a853]/[0.03] blur-3xl rounded-full -z-10" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ S6: CTA SPOTLIGHT ════════════════════════════════════════ */}
      <div id="s-cta" className="relative h-screen overflow-hidden flex flex-col items-center justify-center">
        <SpotlightCanvas />

        <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
          <p
            data-cta
            className="text-[10px] font-bold uppercase tracking-[0.36em] text-[#d4a853]"
            style={{ opacity: 0 }}
          >
            Move your cursor
          </p>

          <h2
            data-cta
            className="max-w-2xl font-black leading-tight tracking-tight"
            style={{
              fontSize: "clamp(2rem, 4vw, 3.6rem)",
              opacity: 0,
              textShadow: "0 0 60px rgba(212,168,83,0.15)",
            }}
          >
            Ready to run your agency<br />
            <span className="text-[#d4a853]">like a director?</span>
          </h2>

          <p data-cta className="text-sm text-white/30 max-w-xs leading-relaxed" style={{ opacity: 0 }}>
            Join media agencies already using CineFlow to close more projects,
            pay fewer subscriptions, and feel in control.
          </p>

          <Link
            data-cta
            href={signupHref}
            className="rounded-2xl bg-[#d4a853] px-8 py-3.5 text-sm font-black text-black transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(212,168,83,0.35)]"
            style={{ opacity: 0 }}
          >
            Start for free →
          </Link>

          <p data-cta className="text-[11px] text-white/20" style={{ opacity: 0 }}>
            No credit card required. Cancel anytime.
          </p>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 text-[10px] text-white/20">
          <Link href="/privacy" className="hover:text-white/40 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white/40 transition-colors">Terms</Link>
          <span>© 2026 CineFlow</span>
        </div>
      </div>

    </div>
  );
}
