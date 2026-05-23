"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { SpotlightCanvas } from "./SpotlightCanvas";
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
  "Shot lists buried in\nemail threads.",
  "Invoices unpaid\nfor 60 days.",
  "Clients texting at\n11pm.",
];

const PANELS = [
  { tag: "Dashboard", line1: "Every project.", line2: "Every status.", line3: "One view.", sub: "Your entire pipeline from brief to delivery — visible at a glance." },
  { tag: "Collaboration", line1: "Your whole crew.", line2: "Fully in", line3: "the loop.", sub: "Individual call times, shot lists, schedule alerts — all in one place." },
  { tag: "Clients & Finance", line1: "Get paid.", line2: "Get approved.", line3: "Move on.", sub: "Professional invoices, client portals, and digital sign-off." },
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
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      // ── Global scroll progress → scrollState (read by canvas) ─────────────
      const globalTrigger = ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (st) => { scrollState.prog = st.progress; },
      });

      // ── Splitting.js on all [data-split] elements ─────────────────────────
      Splitting({ target: "[data-split]", by: "chars" });

      const ctx = gsap.context(() => {

        // ── Hero: gold line sweep ────────────────────────────────────────────
        gsap.fromTo("#hero-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 1.8, ease: "expo.inOut",
            scrollTrigger: { trigger: "#s-hero", start: "top 60%", toggleActions: "play none none none" } }
        );

        // Hero headline chars
        const heroChars = document.querySelectorAll<HTMLElement>("#hero-headline .char");
        if (heroChars.length) {
          gsap.set(heroChars, { y: 100, opacity: 0 });
          gsap.to(heroChars, {
            y: 0, opacity: 1, duration: 1.1, ease: "expo.out", stagger: 0.028,
            scrollTrigger: { trigger: "#s-hero", start: "top 55%", toggleActions: "play none none none" },
            delay: 0.4,
          });
        }

        // Hero subline
        gsap.fromTo("#hero-sub",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out",
            scrollTrigger: { trigger: "#s-hero", start: "top 40%", toggleActions: "play none none none" },
            delay: 0.2,
          }
        );

        // ── Chaos cards orbit ─────────────────────────────────────────────────
        // Cards start invisible, fade in as chaos section enters
        const cardEls = cardRefs.current.filter(Boolean) as HTMLDivElement[];

        gsap.set(cardEls, { opacity: 0, scale: 0.8 });

        ScrollTrigger.create({
          trigger: "#s-chaos",
          start: "top 85%",
          onEnter: () => {
            gsap.to(cardEls, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.06, ease: "back.out(1.4)" });
          },
        });

        // Cards driven by scroll progress within chaos section
        ScrollTrigger.create({
          trigger: "#s-chaos",
          start: "top top",
          end: "bottom top",
          onUpdate: (st) => {
            const prog = st.progress; // 0-1
            const W = window.innerWidth;
            const H = window.innerHeight;
            const cx = W / 2;
            const cy = H / 2;
            const collapse = Math.max(0, (prog - 0.72) / 0.28);
            const collapseEased = 1 - Math.pow(1 - collapse, 3);

            cardEls.forEach((card, i) => {
              const total = cardEls.length;
              const baseAngle = (i / total) * Math.PI * 2;
              // Rotation speed increases with chaos
              const rotSpeed = 1.5 + prog * 6;
              const angle = baseAngle + prog * Math.PI * rotSpeed;
              // Elliptical orbit, radius shrinks on collapse
              const orbitW = (W * 0.34) * (1 - collapseEased * 0.98);
              const orbitH = (H * 0.24) * (1 - collapseEased * 0.98);
              // Individual wobble
              const wobble = prog * 28;
              const wx = Math.sin(prog * 14 + i * 1.9) * wobble;
              const wy = Math.cos(prog * 11 + i * 2.3) * wobble;

              const x = cx + Math.cos(angle) * orbitW + wx;
              const y = cy + Math.sin(angle) * orbitH + wy;
              const rotation = prog * 540 * (i % 2 === 0 ? 1 : -1.3);
              // Cards fade before collapse, then gone
              const cardOpacity = Math.min(1, prog * 4) * (1 - collapseEased * 1.8);

              gsap.set(card, {
                x: x - card.offsetWidth / 2,
                y: y - card.offsetHeight / 2,
                rotation,
                opacity: Math.max(0, cardOpacity),
              });
            });
          },
        });

        // ── Pain points inside chaos ──────────────────────────────────────────
        // Each pain point is tied to a specific scroll range within s-chaos
        const painEls = document.querySelectorAll<HTMLElement>("[data-pain]");
        painEls.forEach((el, i) => {
          const startPct = 0.18 + i * 0.20;
          const endPct   = startPct + 0.18;
          ScrollTrigger.create({
            trigger: "#s-chaos",
            start: `top+=${startPct * 100}% top`,
            end:   `top+=${endPct * 100}% top`,
            onEnter: () => { gsap.fromTo(el, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" }); },
            onLeave: () => { gsap.to(el, { y: -50, opacity: 0, duration: 0.6, ease: "power2.in" }); },
            onEnterBack: () => { gsap.fromTo(el, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" }); },
            onLeaveBack: () => { gsap.to(el, { y: -50, opacity: 0, duration: 0.6, ease: "power2.in" }); },
          });
        });

        // ── "ENOUGH." — Splitting.js char reveal ─────────────────────────────
        const enoughChars = document.querySelectorAll<HTMLElement>("#enough .char");
        if (enoughChars.length) {
          gsap.set(enoughChars, { y: 140, opacity: 0, rotationX: -80 });
          gsap.to(enoughChars, {
            y: 0, opacity: 1, rotationX: 0,
            duration: 1.1, ease: "expo.out", stagger: 0.06,
            scrollTrigger: { trigger: "#s-explode", start: "top 30%", toggleActions: "play none none none" },
            delay: 0.9,
          });
        }

        // ── CineFlow gold line ────────────────────────────────────────────────
        gsap.fromTo("#intro-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 1.7, ease: "expo.inOut",
            scrollTrigger: { trigger: "#s-intro", start: "top 68%", toggleActions: "play none none none" } }
        );

        // ── "CineFlow" — char rise ────────────────────────────────────────────
        const cineChars = document.querySelectorAll<HTMLElement>("#cineflow-word .char");
        if (cineChars.length) {
          gsap.set(cineChars, { y: 180, opacity: 0, skewX: 12 });
          gsap.to(cineChars, {
            y: 0, opacity: 1, skewX: 0,
            duration: 1.2, ease: "expo.out", stagger: 0.055,
            scrollTrigger: { trigger: "#s-intro", start: "top 58%", toggleActions: "play none none none" },
          });
        }

        // Intro subtext
        gsap.fromTo("#intro-sub",
          { y: 36, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out",
            scrollTrigger: { trigger: "#s-intro", start: "top 44%", toggleActions: "play none none none" },
            delay: 0.5,
          }
        );

        // ── Product panels — each panel cross-fades ───────────────────────────
        document.querySelectorAll<HTMLElement>("[data-panel]").forEach((el, i) => {
          gsap.fromTo(el,
            { y: 50, opacity: 0 },
            {
              y: 0, opacity: 1, duration: 1, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 78%", toggleActions: "play none none reverse" },
            }
          );
        });

        // ── CTA section ───────────────────────────────────────────────────────
        const ctaChars = document.querySelectorAll<HTMLElement>("#cta-headline .char");
        if (ctaChars.length) {
          gsap.set(ctaChars, { y: 90, opacity: 0 });
          gsap.to(ctaChars, {
            y: 0, opacity: 1,
            duration: 1.0, ease: "expo.out", stagger: 0.032,
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
        gsap.ticker.remove(tick);
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

      {/* ── Chaos app cards (fixed, animated by GSAP) ─────────────────── */}
      <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
        {APPS.map((app, i) => (
          <div
            key={app.name}
            ref={el => { cardRefs.current[i] = el; }}
            className="absolute flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white"
            style={{
              border: `1px solid ${app.color}55`,
              background: `rgba(8,8,18,0.82)`,
              backdropFilter: "blur(10px)",
              opacity: 0,
              whiteSpace: "nowrap",
            }}
          >
            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: app.color, boxShadow: `0 0 6px ${app.color}` }} />
            {app.name}
          </div>
        ))}
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
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

      {/* ── Scrollable page ────────────────────────────────────────────── */}
      <div className="relative z-20" style={{ background: "transparent" }}>

        {/* ══ S1: HERO ═══════════════════════════════════════════════════ */}
        <section
          id="s-hero"
          className="relative flex h-screen flex-col items-center justify-center px-8 text-center"
        >
          {/* Gold sweep line */}
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

          {/* Scroll indicator */}
          <div className="absolute bottom-12 flex flex-col items-center gap-3">
            <div className="h-10 w-px bg-gradient-to-b from-transparent to-[#d4a853]/40" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/20">Scroll</p>
          </div>
        </section>

        {/* ══ S2: CHAOS ══════════════════════════════════════════════════ */}
        {/* 240vh wrapper = cards orbit for 140vh of scroll */}
        <div id="s-chaos" style={{ height: "240vh" }}>
          <div className="sticky top-0 h-screen overflow-hidden">
            {/* Pain points appear in the center as cards orbit */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 pointer-events-none">
              {PAIN_POINTS.map((pt, i) => (
                <p
                  key={i}
                  data-pain
                  className="absolute text-center font-black leading-tight text-white"
                  style={{
                    fontSize: "clamp(1.6rem, 3.2vw, 2.8rem)",
                    opacity: 0,
                    maxWidth: "500px",
                    whiteSpace: "pre-line",
                    textShadow: "0 0 40px rgba(0,0,0,0.8)",
                  }}
                >
                  <span className="text-[#d4a853]">"</span>{pt}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* ══ S3: EXPLOSION ══════════════════════════════════════════════ */}
        {/* 200vh wrapper = explosion can breathe */}
        <div id="s-explode" style={{ height: "200vh" }}>
          <div className="sticky top-0 h-screen overflow-hidden flex flex-col items-center justify-center px-8">
            <div
              id="enough"
              data-split
              className="font-black leading-none tracking-tighter text-white text-center"
              style={{
                fontSize: "clamp(5rem, 14vw, 11rem)",
                overflow: "hidden",
                perspective: "1000px",
              }}
            >
              ENOUGH.
            </div>
          </div>
        </div>

        {/* ══ S4: CINEFLOW INTRO ══════════════════════════════════════════ */}
        {/* 240vh wrapper = slow cinematic reveal */}
        <div id="s-intro" style={{ height: "240vh" }}>
          <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center px-10 sm:px-20">
            <div className="max-w-5xl">
              {/* Gold line */}
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

              {/* CineFlow — massive Splitting.js reveal */}
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
        {/* Three editorial panels — each with bold typography and a gold accent */}
        <div id="s-panels" style={{ height: "auto", paddingBottom: "8rem" }}>
          {PANELS.map((panel, i) => (
            <div
              key={i}
              data-panel
              className="mx-auto mb-40 max-w-4xl px-10 sm:px-20"
              style={{ opacity: 0 }}
            >
              {/* Index */}
              <p className="mb-6 text-[9px] font-bold uppercase tracking-[0.4em] text-[#d4a853]">
                {String(i + 1).padStart(2, "0")} / {panel.tag}
              </p>

              {/* Big editorial headline */}
              <div
                className="mb-6 font-black leading-[1.0] tracking-tighter text-white"
                style={{ fontSize: "clamp(2.8rem, 6vw, 5.5rem)" }}
              >
                {panel.line1}<br />
                {panel.line2}<br />
                <span className="text-[#d4a853]">{panel.line3}</span>
              </div>

              {/* Divider */}
              <div className="mb-6 h-px w-16 bg-[#d4a853]/50" />

              <p className="max-w-sm text-sm leading-relaxed text-white/35">
                {panel.sub}
              </p>
            </div>
          ))}
        </div>

        {/* ══ S6: CTA SPOTLIGHT ══════════════════════════════════════════ */}
        <div
          id="s-cta"
          className="relative h-screen overflow-hidden flex flex-col items-center justify-center"
        >
          <SpotlightCanvas />

          <div className="relative z-10 flex flex-col items-center gap-7 px-8 text-center">
            {/* CTA headline — Splitting.js */}
            <div
              id="cta-headline"
              data-split
              className="max-w-2xl font-black leading-tight tracking-tight text-white"
              style={{
                fontSize: "clamp(2.2rem, 5vw, 4rem)",
                overflow: "hidden",
                textShadow: "0 0 80px rgba(212,168,83,0.2)",
              }}
            >
              Ready to direct your agency?
            </div>

            <p data-cta className="text-sm text-white/30 max-w-xs leading-relaxed" style={{ opacity: 0 }}>
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

          {/* Footer */}
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
