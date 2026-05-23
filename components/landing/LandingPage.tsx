"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { scrollState } from "./scrollState";

interface Props { refCode?: string }

const APPS = [
  { name: "Frame.io",    color: "#2D9CDB" }, { name: "Milanote",    color: "#E8572A" },
  { name: "Monday.com",  color: "#FF3D57" }, { name: "QuickBooks",  color: "#2CA01C" },
  { name: "HoneyBook",   color: "#C5A3FF" }, { name: "Notion",      color: "#DDDDDD" },
  { name: "Dropbox",     color: "#0061FF" }, { name: "Slack",       color: "#7B68EE" },
  { name: "DocuSign",    color: "#FFBE10" }, { name: "G Sheets",    color: "#34A853" },
  { name: "Trello",      color: "#0052CC" }, { name: "Airtable",    color: "#FCB400" },
];

const PAIN_POINTS = [
  { line1: "Shot lists buried in",   line2: "email threads."  },
  { line1: "Invoices chased",         line2: "for 60 days."   },
  { line1: "Clients texting you",     line2: "at 11pm."       },
];

const PANELS = [
  {
    tag: "Dashboard",
    line1: "Every project.", line2: "Every status.", line3: "One view.",
    sub: "Your entire pipeline from brief to delivery — visible at a glance.",
  },
  {
    tag: "Collaboration",
    line1: "Your whole crew.", line2: "Fully in", line3: "the loop.",
    sub: "Individual call times, shot lists, schedule alerts — all in one place.",
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

      // ── Lenis smooth scroll ────────────────────────────────────────────────
      const lenis = new Lenis({ lerp: 0.082, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const lenisTick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(lenisTick);
      gsap.ticker.lagSmoothing(0);

      // ── Global scroll progress → shared state (read by canvas) ────────────
      const globalTrigger = ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (st) => { scrollState.prog = st.progress; },
      });

      // ── Splitting.js ──────────────────────────────────────────────────────
      Splitting({ target: "[data-split]", by: "chars" });

      function smoothStep(e0: number, e1: number, x: number) {
        const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
      }

      // Track orbit ticker so we can clean it up explicitly
      let orbitTickerFn: (() => void) | null = null;
      let orbitTime = 0;
      const orbit = { r: 0, opacity: 0 };

      const ctx = gsap.context(() => {

        // ── Hero: gold line sweep ────────────────────────────────────────────
        gsap.fromTo("#hero-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 1.8, ease: "expo.inOut",
            scrollTrigger: { trigger: "#s-hero", start: "top 60%", toggleActions: "play none none none" } }
        );

        const heroChars = document.querySelectorAll<HTMLElement>("#hero-headline .char");
        if (heroChars.length) {
          gsap.set(heroChars, { y: 100, opacity: 0 });
          gsap.to(heroChars, {
            y: 0, opacity: 1, duration: 1.1, ease: "expo.out", stagger: 0.028, delay: 0.4,
            scrollTrigger: { trigger: "#s-hero", start: "top 55%", toggleActions: "play none none none" },
          });
        }

        gsap.fromTo("#hero-sub",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.2,
            scrollTrigger: { trigger: "#s-hero", start: "top 40%", toggleActions: "play none none none" } }
        );

        // ── Chaos: time-based orbit (elegant, not scroll-driven) ─────────────
        const cardEls = cardRefs.current.filter(Boolean) as HTMLDivElement[];
        gsap.set(cardEls, { opacity: 0 });

        // ScrollTrigger only controls orbit.r and orbit.opacity — never positions
        ScrollTrigger.create({
          trigger: "#s-chaos",
          start: "top 90%",
          end: "bottom 10%",
          onUpdate: (st) => {
            const p = st.progress;
            orbit.opacity = smoothStep(0, 0.15, p) * (1 - smoothStep(0.88, 1.0, p));
            orbit.r = smoothStep(0, 0.12, p);
          },
        });

        // GSAP ticker drives the actual orbit — constant slow rotation
        orbitTickerFn = () => {
          if (orbit.opacity < 0.005) return;
          orbitTime += 0.004; // ~25s per full revolution
          const W = window.innerWidth;
          const H = window.innerHeight;
          const rx = Math.min(W, H) * 0.38 * orbit.r;
          const ry = Math.min(W, H) * 0.24 * orbit.r;
          cardEls.forEach((card, i) => {
            const angle = (i / cardEls.length) * Math.PI * 2 + orbitTime;
            const x = W / 2 + Math.cos(angle) * rx - card.offsetWidth / 2;
            const y = H / 2 + Math.sin(angle) * ry - card.offsetHeight / 2;
            gsap.set(card, { x, y, opacity: orbit.opacity });
          });
        };
        gsap.ticker.add(orbitTickerFn);

        // ── Pain points: single onUpdate, only one visible at a time ──────────
        const painEls = Array.from(document.querySelectorAll<HTMLElement>("[data-pain]"));
        gsap.set(painEls, { opacity: 0, y: 0 });

        ScrollTrigger.create({
          trigger: "#s-chaos",
          start: "top top",
          end: "bottom top",
          onUpdate: (st) => {
            const p = st.progress;
            // Each pain point fades in then out — ranges never overlap
            const v0 = smoothStep(0.08, 0.18, p) * (1 - smoothStep(0.30, 0.42, p));
            const v1 = smoothStep(0.42, 0.52, p) * (1 - smoothStep(0.62, 0.74, p));
            const v2 = smoothStep(0.74, 0.84, p) * (1 - smoothStep(0.90, 0.98, p));
            const vals = [v0, v1, v2];
            painEls.forEach((el, i) => {
              const v = vals[i] ?? 0;
              gsap.set(el, { opacity: v, y: (1 - v) * 22 });
            });
          },
        });

        // ── "ENOUGH." — Splitting.js char reveal ─────────────────────────────
        const enoughChars = document.querySelectorAll<HTMLElement>("#enough .char");
        if (enoughChars.length) {
          gsap.set(enoughChars, { y: 140, opacity: 0, rotationX: -80 });
          gsap.to(enoughChars, {
            y: 0, opacity: 1, rotationX: 0,
            duration: 1.1, ease: "expo.out", stagger: 0.06, delay: 0.9,
            scrollTrigger: { trigger: "#s-explode", start: "top 30%", toggleActions: "play none none none" },
          });
        }

        // ── CineFlow intro gold line ───────────────────────────────────────────
        gsap.fromTo("#intro-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 1.7, ease: "expo.inOut",
            scrollTrigger: { trigger: "#s-intro", start: "top 68%", toggleActions: "play none none none" } }
        );

        const cineChars = document.querySelectorAll<HTMLElement>("#cineflow-word .char");
        if (cineChars.length) {
          gsap.set(cineChars, { y: 180, opacity: 0, skewX: 12 });
          gsap.to(cineChars, {
            y: 0, opacity: 1, skewX: 0,
            duration: 1.2, ease: "expo.out", stagger: 0.055,
            scrollTrigger: { trigger: "#s-intro", start: "top 58%", toggleActions: "play none none none" },
          });
        }

        gsap.fromTo("#intro-sub",
          { y: 36, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.5,
            scrollTrigger: { trigger: "#s-intro", start: "top 44%", toggleActions: "play none none none" } }
        );

        // ── Product panels ────────────────────────────────────────────────────
        document.querySelectorAll<HTMLElement>("[data-panel]").forEach((el) => {
          gsap.fromTo(el,
            { y: 60, opacity: 0 },
            { y: 0, opacity: 1, duration: 1.1, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 80%", toggleActions: "play none none reverse" } }
          );
        });

        // ── CTA ───────────────────────────────────────────────────────────────
        const ctaChars = document.querySelectorAll<HTMLElement>("#cta-headline .char");
        if (ctaChars.length) {
          gsap.set(ctaChars, { y: 90, opacity: 0 });
          gsap.to(ctaChars, {
            y: 0, opacity: 1, duration: 1.0, ease: "expo.out", stagger: 0.032,
            scrollTrigger: { trigger: "#s-cta", start: "top 72%", toggleActions: "play none none none" },
          });
        }
        document.querySelectorAll<HTMLElement>("[data-cta]").forEach((el, i) => {
          gsap.fromTo(el,
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
              scrollTrigger: { trigger: "#s-cta", start: "top 65%", toggleActions: "play none none none" },
              delay: 0.5 + i * 0.14,
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
      {/* ── Atmospheric background canvas (fixed) ──────────────────────── */}
      <BackgroundCanvas />

      {/* ── App cards (fixed, driven by GSAP ticker) ────────────────────── */}
      <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
        {APPS.map((app, i) => (
          <div
            key={app.name}
            ref={el => { cardRefs.current[i] = el; }}
            className="absolute flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white"
            style={{
              border: `1px solid ${app.color}55`,
              background: "rgba(8,8,18,0.82)",
              backdropFilter: "blur(10px)",
              opacity: 0,
              whiteSpace: "nowrap",
            }}
          >
            <div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: app.color, boxShadow: `0 0 6px ${app.color}` }}
            />
            {app.name}
          </div>
        ))}
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#d4a853]/40 bg-[#d4a853]/10 backdrop-blur-sm">
            <Film className="h-4 w-4 text-[#d4a853]" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white drop-shadow-lg">CineFlow</span>
        </div>
        <Link
          href={signupHref}
          className="rounded-xl border border-[#d4a853]/50 bg-black/40 px-4 py-2 text-xs font-bold text-[#d4a853] backdrop-blur-sm transition-all hover:bg-[#d4a853] hover:text-black"
        >
          Get early access
        </Link>
      </nav>

      {/* ── Scrollable page ──────────────────────────────────────────────── */}
      <div className="relative z-20" style={{ background: "transparent" }}>

        {/* ══ S1: HERO ════════════════════════════════════════════════════ */}
        <section
          id="s-hero"
          className="relative flex h-screen flex-col items-center justify-center px-8 text-center"
        >
          <div className="mb-10 w-full max-w-3xl overflow-hidden">
            <div
              id="hero-line"
              className="h-px w-full bg-[#d4a853]"
              style={{ transformOrigin: "left center", transform: "scaleX(0)" }}
            />
          </div>

          <p className="mb-6 text-[9px] font-bold uppercase tracking-[0.45em] text-[#d4a853]">
            The problem
          </p>

          <div
            id="hero-headline"
            data-split
            className="max-w-3xl font-black leading-[1.06] tracking-tighter text-white"
            style={{ fontSize: "clamp(2.4rem, 5vw, 4.4rem)", overflow: "hidden", perspective: "800px" }}
          >
            Seven tools. One production. Zero clarity.
          </div>

          <p
            id="hero-sub"
            className="mt-8 max-w-sm text-sm leading-relaxed text-white/35"
            style={{ opacity: 0 }}
          >
            The average media agency stitches together 7 separate subscriptions
            just to manage a single shoot. It shouldn&apos;t be this hard.
          </p>

          <div className="absolute bottom-12 flex flex-col items-center gap-3">
            <div className="h-10 w-px bg-gradient-to-b from-transparent to-[#d4a853]/40" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/20">Scroll</p>
          </div>
        </section>

        {/* ══ S2: CHAOS — cards orbit + sequential pain points ════════════ */}
        <div id="s-chaos" style={{ height: "320vh" }}>
          <div className="sticky top-0 h-screen overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {PAIN_POINTS.map((pt, i) => (
                <p
                  key={i}
                  data-pain
                  className="absolute text-center font-black leading-tight text-white"
                  style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", opacity: 0, maxWidth: "600px" }}
                >
                  {pt.line1}<br />
                  <span className="text-[#d4a853]">{pt.line2}</span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* ══ S3: EXPLOSION ═══════════════════════════════════════════════ */}
        <div id="s-explode" style={{ height: "200vh" }}>
          <div className="sticky top-0 h-screen overflow-hidden flex flex-col items-center justify-center px-8">
            <div
              id="enough"
              data-split
              className="font-black leading-none tracking-tighter text-white text-center"
              style={{ fontSize: "clamp(5rem, 14vw, 11rem)", overflow: "hidden", perspective: "1000px" }}
            >
              ENOUGH.
            </div>
          </div>
        </div>

        {/* ══ S4: CINEFLOW INTRO ══════════════════════════════════════════ */}
        <div id="s-intro" style={{ height: "240vh" }}>
          <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center px-10 sm:px-20">
            <div className="max-w-5xl">
              <div className="mb-10 overflow-hidden">
                <div
                  id="intro-line"
                  className="h-px w-full"
                  style={{
                    background: "linear-gradient(90deg, #d4a853, #fff8e0, #d4a853)",
                    transformOrigin: "left center",
                    transform: "scaleX(0)",
                    boxShadow: "0 0 12px rgba(212,168,83,0.5)",
                  }}
                />
              </div>

              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.45em] text-[#d4a853]">
                Introducing
              </p>

              <div
                id="cineflow-word"
                data-split
                className="font-black leading-none tracking-tighter"
                style={{
                  fontSize: "clamp(5rem, 13vw, 10.5rem)",
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #ffffff 45%, #d4a853 75%, #fff8e0 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                CineFlow
              </div>

              <p
                id="intro-sub"
                className="mt-8 max-w-md text-base leading-relaxed text-white/38"
                style={{ opacity: 0 }}
              >
                One platform. Every production. Total control.<br />
                Built for agencies that are done juggling.
              </p>
            </div>
          </div>
        </div>

        {/* ══ S5: PRODUCT PANELS ══════════════════════════════════════════ */}
        <div id="s-panels" style={{ paddingBottom: "10rem" }}>
          {PANELS.map((panel, i) => (
            <div
              key={i}
              data-panel
              className="mx-auto mb-44 max-w-4xl px-10 sm:px-20"
              style={{ opacity: 0 }}
            >
              <p className="mb-6 text-[9px] font-bold uppercase tracking-[0.4em] text-[#d4a853]">
                {String(i + 1).padStart(2, "0")} / {panel.tag}
              </p>

              <div
                className="mb-6 font-black leading-[1.0] tracking-tighter text-white"
                style={{ fontSize: "clamp(2.8rem, 6vw, 5.5rem)" }}
              >
                {panel.line1}<br />
                {panel.line2}<br />
                <span className="text-[#d4a853]">{panel.line3}</span>
              </div>

              <div className="mb-6 h-px w-16 bg-[#d4a853]/50" />

              <p className="max-w-sm text-sm leading-relaxed text-white/35">
                {panel.sub}
              </p>
            </div>
          ))}
        </div>

        {/* ══ S6: CTA — clean dark, no spotlight ══════════════════════════ */}
        <div
          id="s-cta"
          className="relative h-screen flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Subtle ambient gold bloom — static, no movement */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 70% 50% at 50% 58%, rgba(212,168,83,0.06) 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-7 px-8 text-center">
            <div
              id="cta-headline"
              data-split
              className="max-w-2xl font-black leading-tight tracking-tight text-white"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)", overflow: "hidden" }}
            >
              Ready to direct your agency?
            </div>

            <p
              data-cta
              className="text-sm text-white/30 max-w-xs leading-relaxed"
              style={{ opacity: 0 }}
            >
              Join media agencies already running on CineFlow.
              One platform, total clarity.
            </p>

            <Link
              data-cta
              href={signupHref}
              className="rounded-2xl bg-[#d4a853] px-9 py-4 text-sm font-black text-black transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(212,168,83,0.5)]"
              style={{ opacity: 0 }}
            >
              Start for free →
            </Link>

            <p data-cta className="text-[11px] text-white/20" style={{ opacity: 0 }}>
              No credit card required. Cancel anytime.
            </p>
          </div>

          <div className="absolute bottom-7 left-0 right-0 flex justify-center gap-8 text-[10px] text-white/20">
            <Link href="/privacy" className="hover:text-white/40 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/40 transition-colors">Terms</Link>
            <span>© 2026 CineFlow</span>
          </div>
        </div>

      </div>
    </>
  );
}
