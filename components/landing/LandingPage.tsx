"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { scrollState } from "./scrollState";

interface Props { refCode?: string }

const FRAGMENTS: { text: string; mono?: boolean }[] = [
  { text: '"where are we at?" · 11:47pm' },
  { text: "Invoice_v4_FINAL_FINAL.pdf",      mono: true },
  { text: '"did anyone brief the client?"' },
  { text: "shot_list_REVISED_use_this.xlsx", mono: true },
  { text: '"can you resend the contract?"' },
  { text: "Client approval: pending 14d" },
  { text: '"what time is call time again?"' },
  { text: "Budget_Spreadsheet_v3.xlsx",      mono: true },
  { text: '"who has the location notes?"' },
  { text: "Schedule_FINAL_v7_USE_THIS.pdf",  mono: true },
  { text: "Revision request · overdue" },
  { text: '"just checking in again..."' },
];

const PAIN_POINTS = [
  "Shot lists buried in email threads.",
  "Invoices chased for 60 days.",
  "Clients texting you at 11pm.",
];

const PANELS = [
  {
    tag: "Dashboard",
    line1: "Every project.", line2: "Every status.", line3: "One view.",
    sub: "Your entire pipeline from pre-pro to delivery — visible at a glance.",
  },
  {
    tag: "Collaboration",
    line1: "Your whole crew.", line2: "Fully in", line3: "the loop.",
    sub: "Call times, shot lists, and schedule alerts — everyone stays informed.",
  },
  {
    tag: "Clients & Finance",
    line1: "Get paid.", line2: "Get approved.", line3: "Move on.",
    sub: "Professional invoices, client portals, and digital sign-off.",
  },
];

export function LandingPage({ refCode }: Props) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const signupHref = refCode ? `/signup?ref=${refCode}` : "/signup";

  useEffect(() => {
    let kill: (() => void) | undefined;

    (async () => {
      const { default: gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      const { default: Lenis } = await import("lenis");
      const Splitting = (await import("splitting")).default;

      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const lenisTick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(lenisTick);
      gsap.ticker.lagSmoothing(0);

      const globalTrigger = ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (st) => { scrollState.prog = st.progress; },
      });

      Splitting({ target: "[data-split]", by: "chars" });

      function smoothStep(e0: number, e1: number, x: number) {
        const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
      }

      let orbitTickerFn: (() => void) | null = null;
      let orbitTime = 0;
      const orbit = { r: 0, opacity: 0 };

      const ctx = gsap.context(() => {

        // ── Hero ─────────────────────────────────────────────────────────────
        gsap.fromTo("#hero-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 2.0, ease: "expo.inOut",
            scrollTrigger: { trigger: "#s-hero", start: "top 65%", toggleActions: "play none none none" } }
        );

        const heroChars = document.querySelectorAll<HTMLElement>("#hero-headline .char");
        if (heroChars.length) {
          gsap.set(heroChars, { y: 80, opacity: 0 });
          gsap.to(heroChars, {
            y: 0, opacity: 1, duration: 1.0, ease: "expo.out", stagger: 0.02, delay: 0.35,
            scrollTrigger: { trigger: "#s-hero", start: "top 60%", toggleActions: "play none none none" },
          });
        }

        gsap.fromTo("#hero-sub",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, ease: "power3.out", delay: 0.25,
            scrollTrigger: { trigger: "#s-hero", start: "top 45%", toggleActions: "play none none none" } }
        );

        // ── Fragment orbit — driven by time, not scroll ───────────────────────
        const cardEls = cardRefs.current.filter(Boolean) as HTMLDivElement[];
        gsap.set(cardEls, { opacity: 0 });

        ScrollTrigger.create({
          trigger: "#s-chaos",
          start: "top 90%",
          end: "bottom 10%",
          onUpdate: (st) => {
            const p = st.progress;
            orbit.opacity = smoothStep(0, 0.12, p) * (1 - smoothStep(0.86, 1.0, p));
            orbit.r = smoothStep(0, 0.10, p);
          },
        });

        orbitTickerFn = () => {
          if (orbit.opacity < 0.005) return;
          orbitTime += 0.003; // ~35s per base revolution
          const W = window.innerWidth;
          const H = window.innerHeight;
          const baseRx = Math.min(W, H) * 0.44 * orbit.r;
          const baseRy = Math.min(W, H) * 0.26 * orbit.r;

          cardEls.forEach((card, i) => {
            const total = cardEls.length;
            const spread = 0.68 + (i % 4) * 0.09;   // vary orbit radius
            const speed  = 0.55 + (i % 3) * 0.15;   // vary angular speed
            const angle  = (i / total) * Math.PI * 2 + orbitTime * speed;
            const x = W / 2 + Math.cos(angle) * baseRx * spread - card.offsetWidth / 2;
            const y = H / 2 + Math.sin(angle) * baseRy * spread - card.offsetHeight / 2;
            const depth = 0.38 + (i % 3) * 0.19;    // depth-based opacity
            gsap.set(card, { x, y, opacity: orbit.opacity * depth });
          });
        };
        gsap.ticker.add(orbitTickerFn);

        // ── Pain points — one at a time via smoothStep ────────────────────────
        const painEls = Array.from(document.querySelectorAll<HTMLElement>("[data-pain]"));
        gsap.set(painEls, { opacity: 0, y: 0 });

        ScrollTrigger.create({
          trigger: "#s-chaos",
          start: "top top",
          end: "bottom top",
          onUpdate: (st) => {
            const p = st.progress;
            const v0 = smoothStep(0.06, 0.16, p) * (1 - smoothStep(0.28, 0.36, p));
            const v1 = smoothStep(0.36, 0.46, p) * (1 - smoothStep(0.58, 0.66, p));
            const v2 = smoothStep(0.66, 0.76, p) * (1 - smoothStep(0.84, 0.92, p));
            [v0, v1, v2].forEach((v, i) => {
              gsap.set(painEls[i], { opacity: v, y: (1 - v) * 16 });
            });
          },
        });

        // ── ENOUGH ───────────────────────────────────────────────────────────
        const enoughChars = document.querySelectorAll<HTMLElement>("#enough .char");
        if (enoughChars.length) {
          gsap.set(enoughChars, { y: 90, opacity: 0, rotationX: -65 });
          gsap.to(enoughChars, {
            y: 0, opacity: 1, rotationX: 0,
            duration: 1.0, ease: "expo.out", stagger: 0.05, delay: 0.6,
            scrollTrigger: { trigger: "#s-explode", start: "top 35%", toggleActions: "play none none none" },
          });
        }

        gsap.fromTo("#enough-sub",
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, ease: "power2.out", delay: 1.3,
            scrollTrigger: { trigger: "#s-explode", start: "top 35%", toggleActions: "play none none none" } }
        );

        // ── CineFlow intro ────────────────────────────────────────────────────
        gsap.fromTo("#intro-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 1.6, ease: "expo.inOut",
            scrollTrigger: { trigger: "#s-intro", start: "top 70%", toggleActions: "play none none none" } }
        );

        const cineChars = document.querySelectorAll<HTMLElement>("#cineflow-word .char");
        if (cineChars.length) {
          gsap.set(cineChars, { y: 150, opacity: 0, skewX: 8 });
          gsap.to(cineChars, {
            y: 0, opacity: 1, skewX: 0,
            duration: 1.1, ease: "expo.out", stagger: 0.048,
            scrollTrigger: { trigger: "#s-intro", start: "top 60%", toggleActions: "play none none none" },
          });
        }

        gsap.fromTo("#intro-sub",
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.5,
            scrollTrigger: { trigger: "#s-intro", start: "top 46%", toggleActions: "play none none none" } }
        );

        // ── Product panels ────────────────────────────────────────────────────
        document.querySelectorAll<HTMLElement>("[data-panel]").forEach((el) => {
          gsap.fromTo(el,
            { y: 44, opacity: 0 },
            { y: 0, opacity: 1, duration: 1.0, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 82%", toggleActions: "play none none reverse" } }
          );
        });

        // ── CTA ───────────────────────────────────────────────────────────────
        const ctaChars = document.querySelectorAll<HTMLElement>("#cta-headline .char");
        if (ctaChars.length) {
          gsap.set(ctaChars, { y: 70, opacity: 0 });
          gsap.to(ctaChars, {
            y: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.022,
            scrollTrigger: { trigger: "#s-cta", start: "top 74%", toggleActions: "play none none none" },
          });
        }
        document.querySelectorAll<HTMLElement>("[data-cta]").forEach((el, i) => {
          gsap.fromTo(el,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
              scrollTrigger: { trigger: "#s-cta", start: "top 66%", toggleActions: "play none none none" },
              delay: 0.55 + i * 0.12,
            }
          );
        });

      });

      kill = () => {
        if (orbitTickerFn) gsap.ticker.remove(orbitTickerFn);
        gsap.ticker.remove(lenisTick);
        lenis.destroy();
        ctx.revert();
        globalTrigger.kill();
      };
    })();

    return () => kill?.();
  }, []);

  return (
    <>
      <BackgroundCanvas />

      {/* ── Chaos fragments (fixed, time-driven orbit) ───────────────────── */}
      <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
        {FRAGMENTS.map((frag, i) => (
          <div
            key={i}
            ref={el => { cardRefs.current[i] = el; }}
            className="absolute rounded-md px-3 py-1.5 text-white/60"
            style={{
              fontSize: "11px",
              fontFamily: frag.mono
                ? "'SF Mono', 'Fira Code', 'Courier New', monospace"
                : "inherit",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(6,6,14,0.72)",
              backdropFilter: "blur(8px)",
              opacity: 0,
              whiteSpace: "nowrap",
              letterSpacing: frag.mono ? "0.01em" : "-0.01em",
            }}
          >
            {frag.text}
          </div>
        ))}
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d4a853]/40 bg-[#d4a853]/10">
            <Film className="h-3.5 w-3.5 text-[#d4a853]" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white/90">CineFlow</span>
        </div>
        <Link
          href={signupHref}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur-sm transition-all hover:border-[#d4a853]/50 hover:text-[#d4a853]"
        >
          Get early access
        </Link>
      </nav>

      {/* ── Scrollable page ──────────────────────────────────────────────── */}
      <div className="relative z-20" style={{ background: "transparent" }}>

        {/* ══ HERO ════════════════════════════════════════════════════════ */}
        <section id="s-hero" className="relative flex h-screen flex-col items-center justify-center px-8 text-center">
          <div className="mb-14 w-full max-w-5xl overflow-hidden">
            <div
              id="hero-line"
              className="h-px w-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(212,168,83,0.5), transparent)",
                transformOrigin: "left center",
                transform: "scaleX(0)",
              }}
            />
          </div>

          <div
            id="hero-headline"
            data-split
            className="max-w-5xl font-black leading-[1.04] tracking-tighter text-white"
            style={{ fontSize: "clamp(2.8rem, 4.8vw, 5rem)", overflow: "hidden" }}
          >
            Seven tools. One production. Zero clarity.
          </div>

          <p
            id="hero-sub"
            className="mt-7 max-w-sm text-sm leading-relaxed text-white/28"
            style={{ opacity: 0 }}
          >
            Production teams spend more time managing tools than making work.
            There&apos;s a better way.
          </p>

          <div className="absolute bottom-10 flex flex-col items-center gap-3">
            <div className="h-14 w-px bg-gradient-to-b from-transparent to-[#d4a853]/25" />
            <p className="font-mono text-[8px] tracking-[0.35em] text-white/15 uppercase">Scroll</p>
          </div>
        </section>

        {/* ══ CHAOS — fragments orbit + sequential pain points ════════════ */}
        <div id="s-chaos" style={{ height: "280vh" }}>
          <div className="sticky top-0 h-screen overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {PAIN_POINTS.map((pt, i) => (
                <p
                  key={i}
                  data-pain
                  className="absolute text-center font-black leading-[1.1] tracking-tight text-white"
                  style={{
                    fontSize: "clamp(2.2rem, 4vw, 3.8rem)",
                    opacity: 0,
                    maxWidth: "680px",
                  }}
                >
                  {pt}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* ══ ENOUGH ══════════════════════════════════════════════════════ */}
        <div id="s-explode" style={{ height: "160vh" }}>
          <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-8">
            <div
              id="enough"
              data-split
              className="font-black leading-none tracking-tighter text-white text-center"
              style={{ fontSize: "clamp(3.8rem, 9vw, 7.5rem)", overflow: "hidden", perspective: "800px" }}
            >
              ENOUGH.
            </div>
            <p
              id="enough-sub"
              className="mt-5 font-mono text-[10px] tracking-[0.3em] uppercase text-white/20"
              style={{ opacity: 0 }}
            >
              There&apos;s a better way.
            </p>
          </div>
        </div>

        {/* ══ CINEFLOW INTRO ══════════════════════════════════════════════ */}
        <div id="s-intro" style={{ height: "200vh" }}>
          <div className="sticky top-0 h-screen flex flex-col justify-center px-10 sm:px-20">
            <div className="max-w-5xl">
              <div className="mb-7 overflow-hidden">
                <div
                  id="intro-line"
                  style={{
                    width: "36px",
                    height: "1px",
                    background: "#d4a853",
                    transformOrigin: "left center",
                    transform: "scaleX(0)",
                  }}
                />
              </div>

              <p className="mb-4 font-mono text-[10px] tracking-[0.4em] uppercase text-[#d4a853]/60">
                Introducing
              </p>

              <div
                id="cineflow-word"
                data-split
                className="font-black leading-none tracking-tighter"
                style={{
                  fontSize: "clamp(4.5rem, 12vw, 10rem)",
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #ffffff 38%, #d4a853 68%, #fff3c4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                CineFlow
              </div>

              <p
                id="intro-sub"
                className="mt-6 max-w-xs text-sm leading-relaxed text-white/28"
                style={{ opacity: 0 }}
              >
                One platform. Every production. Total control.
              </p>
            </div>
          </div>
        </div>

        {/* ══ PRODUCT PANELS ══════════════════════════════════════════════ */}
        <div id="s-panels" style={{ paddingBottom: "7rem" }}>
          {PANELS.map((panel, i) => (
            <div
              key={i}
              data-panel
              className="mx-auto mb-28 max-w-4xl px-10 sm:px-20"
              style={{ opacity: 0 }}
            >
              <p className="mb-5 font-mono text-[10px] tracking-[0.35em] uppercase text-[#d4a853]/50">
                {String(i + 1).padStart(2, "0")} — {panel.tag}
              </p>

              <div
                className="mb-5 font-black leading-[1.0] tracking-tighter text-white"
                style={{ fontSize: "clamp(2.6rem, 5.5vw, 5rem)" }}
              >
                {panel.line1}<br />
                {panel.line2}<br />
                <span className="text-[#d4a853]">{panel.line3}</span>
              </div>

              <div className="mb-5 h-px w-8 bg-[#d4a853]/25" />

              <p className="max-w-xs text-[13px] leading-relaxed text-white/25">
                {panel.sub}
              </p>
            </div>
          ))}
        </div>

        {/* ══ CTA ═════════════════════════════════════════════════════════ */}
        <div
          id="s-cta"
          className="relative h-screen flex flex-col items-center justify-center overflow-hidden"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 55% 42% at 50% 54%, rgba(212,168,83,0.055) 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-5 px-8 text-center">
            <div
              id="cta-headline"
              data-split
              className="max-w-2xl font-black leading-[1.04] tracking-tighter text-white"
              style={{ fontSize: "clamp(2.4rem, 5vw, 4.5rem)", overflow: "hidden" }}
            >
              One platform. Total clarity.
            </div>

            <p
              data-cta
              className="text-[13px] text-white/25 max-w-xs leading-relaxed"
              style={{ opacity: 0 }}
            >
              Join productions already running on CineFlow.
            </p>

            <Link
              data-cta
              href={signupHref}
              className="mt-1 rounded-xl bg-[#d4a853] px-8 py-3.5 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(212,168,83,0.35)]"
              style={{ opacity: 0 }}
            >
              Start for free →
            </Link>

            <p
              data-cta
              className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/15"
              style={{ opacity: 0 }}
            >
              No credit card required
            </p>
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8 font-mono text-[9px] tracking-widest uppercase text-white/12">
            <Link href="/privacy" className="hover:text-white/30 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/30 transition-colors">Terms</Link>
            <span>© 2026 CineFlow</span>
          </div>
        </div>

      </div>
    </>
  );
}
