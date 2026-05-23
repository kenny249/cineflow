"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { scrollState } from "./scrollState";

interface Props { refCode?: string }

const FRAGMENTS: { text: string; mono?: boolean }[] = [
  { text: '"where are we at?" · 11:47pm' },
  { text: "Invoice_v4_FINAL_FINAL.pdf",          mono: true },
  { text: '"did you get the rough cut link?"' },
  { text: "shot_list_REVISED_use_this.xlsx",     mono: true },
  { text: '"can you resend the contract?"' },
  { text: "Client approval: pending 14d" },
  { text: '"what time is call time again?"' },
  { text: "call_sheet_saturday_v4.pdf",          mono: true },
  { text: '"who has the location notes?"' },
  { text: "Schedule_FINAL_v7_USE_THIS.pdf",      mono: true },
  { text: '"I never got the invoice 🙏"' },
  { text: '"just checking in again..."' },
];

const PANELS = [
  {
    tag: "Production",
    line1: "Your whole", line2: "production.", line3: "One view.",
    sub: "Shot lists, call sheets, and scheduling — everything your crew needs, right where your project lives.",
    note: "Replaces StudioBinder + Notion",
  },
  {
    tag: "Client Portal",
    line1: "Clients stay", line2: "in the loop.", line3: "Automatically.",
    sub: "Every client gets their own portal. They see progress, approve cuts, and sign off — without texting you.",
    note: 'No more "hey, are the videos done yet?"',
  },
  {
    tag: "Payments",
    line1: "Stop chasing", line2: "your own", line3: "money.",
    sub: "Professional invoices, deposit collection, and automated reminders — right next to the project.",
    note: "Replaces HoneyBook + DocuSign",
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

      const lenis = new Lenis({ lerp: 0.06, smoothWheel: true });
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

        gsap.fromTo("#hero-kicker",
          { opacity: 0 },
          { opacity: 1, duration: 1.4, ease: "power2.out",
            scrollTrigger: { trigger: "#s-hero", start: "top 62%", toggleActions: "play none none none" } }
        );

        gsap.fromTo("#hero-headline",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.5, ease: "power3.out", delay: 0.2,
            scrollTrigger: { trigger: "#s-hero", start: "top 58%", toggleActions: "play none none none" } }
        );

        gsap.fromTo("#hero-sub",
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", delay: 0.5,
            scrollTrigger: { trigger: "#s-hero", start: "top 54%", toggleActions: "play none none none" } }
        );

        gsap.fromTo("#hero-cta",
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.0, ease: "power3.out", delay: 0.8,
            scrollTrigger: { trigger: "#s-hero", start: "top 54%", toggleActions: "play none none none" } }
        );

        // ── Fragment orbit — time-based ───────────────────────────────────────
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
          orbitTime += 0.003;
          const W = window.innerWidth;
          const H = window.innerHeight;
          const baseRx = Math.min(W, H) * 0.44 * orbit.r;
          const baseRy = Math.min(W, H) * 0.26 * orbit.r;
          cardEls.forEach((card, i) => {
            const spread = 0.68 + (i % 4) * 0.09;
            const speed  = 0.55 + (i % 3) * 0.15;
            const angle  = (i / cardEls.length) * Math.PI * 2 + orbitTime * speed;
            const x = W / 2 + Math.cos(angle) * baseRx * spread - card.offsetWidth / 2;
            const y = H / 2 + Math.sin(angle) * baseRy * spread - card.offsetHeight / 2;
            gsap.set(card, { x, y, opacity: orbit.opacity * (0.38 + (i % 3) * 0.19) });
          });
        };
        gsap.ticker.add(orbitTickerFn);

        // ── Pain points — blur + opacity crossfade, no Y movement ─────────────
        const painEls = Array.from(document.querySelectorAll<HTMLElement>("[data-pain]"));
        gsap.set(painEls, { opacity: 0, filter: "blur(8px)" });

        ScrollTrigger.create({
          trigger: "#s-chaos",
          start: "top top",
          end: "bottom top",
          onUpdate: (st) => {
            const p = st.progress;
            const v0 = smoothStep(0.06, 0.17, p) * (1 - smoothStep(0.30, 0.40, p));
            const v1 = smoothStep(0.40, 0.51, p) * (1 - smoothStep(0.62, 0.72, p));
            const v2 = smoothStep(0.72, 0.82, p) * (1 - smoothStep(0.90, 0.97, p));
            [v0, v1, v2].forEach((v, i) => {
              gsap.set(painEls[i], { opacity: v, filter: `blur(${(1 - v) * 7}px)` });
            });
          },
        });

        // ── ENOUGH ───────────────────────────────────────────────────────────
        const enoughChars = document.querySelectorAll<HTMLElement>("#enough .char");
        if (enoughChars.length) {
          gsap.set(enoughChars, { y: 80, opacity: 0, rotationX: -55 });
          gsap.to(enoughChars, {
            y: 0, opacity: 1, rotationX: 0,
            duration: 0.9, ease: "expo.out", stagger: 0.045, delay: 0.5,
            scrollTrigger: { trigger: "#s-explode", start: "top 40%", toggleActions: "play none none none" },
          });
        }

        gsap.fromTo("#enough-sub",
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, ease: "power2.out", delay: 1.1,
            scrollTrigger: { trigger: "#s-explode", start: "top 40%", toggleActions: "play none none none" } }
        );

        // ── CineFlow intro ────────────────────────────────────────────────────
        gsap.fromTo("#intro-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 1.5, ease: "expo.inOut",
            scrollTrigger: { trigger: "#s-intro", start: "top 70%", toggleActions: "play none none none" } }
        );

        const cineChars = document.querySelectorAll<HTMLElement>("#cineflow-word .char");
        if (cineChars.length) {
          gsap.set(cineChars, { y: 130, opacity: 0, skewX: 8 });
          gsap.to(cineChars, {
            y: 0, opacity: 1, skewX: 0,
            duration: 1.1, ease: "expo.out", stagger: 0.045,
            scrollTrigger: { trigger: "#s-intro", start: "top 60%", toggleActions: "play none none none" },
          });
        }

        gsap.fromTo("#intro-sub",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.45,
            scrollTrigger: { trigger: "#s-intro", start: "top 48%", toggleActions: "play none none none" } }
        );

        // ── Sticky cycling panels ─────────────────────────────────────────────
        gsap.set("#panel-0", { opacity: 1, filter: "blur(0px)" });
        gsap.set(["#panel-1", "#panel-2"], { opacity: 0, filter: "blur(6px)" });

        ScrollTrigger.create({
          trigger: "#s-panels",
          start: "top top",
          end: "bottom top",
          onUpdate: (st) => {
            const p = st.progress;
            const op0 = 1 - smoothStep(0.28, 0.37, p);
            const op1 = smoothStep(0.28, 0.37, p) * (1 - smoothStep(0.62, 0.71, p));
            const op2 = smoothStep(0.62, 0.71, p);
            gsap.set("#panel-0", { opacity: op0, filter: `blur(${(1 - op0) * 5}px)` });
            gsap.set("#panel-1", { opacity: op1, filter: `blur(${(1 - op1) * 5}px)` });
            gsap.set("#panel-2", { opacity: op2, filter: `blur(${(1 - op2) * 5}px)` });
          },
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
            { y: 18, opacity: 0 },
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

      <div className="relative z-20" style={{ background: "transparent" }}>

        {/* ══ HERO ════════════════════════════════════════════════════════ */}
        <section
          id="s-hero"
          className="relative flex h-screen flex-col items-center justify-center px-8 text-center"
        >
          <div className="mb-12 w-full max-w-3xl overflow-hidden">
            <div
              id="hero-line"
              className="h-px w-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(212,168,83,0.4), transparent)",
                transformOrigin: "left center",
                transform: "scaleX(0)",
              }}
            />
          </div>

          <p
            id="hero-kicker"
            className="mb-5 text-[13px] font-medium tracking-wide text-white/30"
            style={{ opacity: 0 }}
          >
            For filmmakers and video production teams
          </p>

          <h1
            id="hero-headline"
            className="max-w-3xl font-black leading-[1.05] tracking-tighter text-white"
            style={{ fontSize: "clamp(2rem, 3.6vw, 3.4rem)", opacity: 0 }}
          >
            Stop stitching your<br />production together.
          </h1>

          <p
            id="hero-sub"
            className="mt-6 max-w-sm text-[13px] leading-relaxed text-white/35"
            style={{ opacity: 0 }}
          >
            Shot lists, client portals, invoicing, crew scheduling —<br />
            all flowing in one place. Finally.
          </p>

          <Link
            id="hero-cta"
            href={signupHref}
            className="mt-8 rounded-xl bg-[#d4a853] px-7 py-3 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_36px_rgba(212,168,83,0.35)]"
            style={{ opacity: 0 }}
          >
            Start for free →
          </Link>

          <div className="absolute bottom-10 flex flex-col items-center gap-3">
            <div className="h-12 w-px bg-gradient-to-b from-transparent to-[#d4a853]/25" />
            <p className="font-mono text-[8px] tracking-[0.35em] text-white/15 uppercase">Scroll</p>
          </div>
        </section>

        {/* ══ CHAOS — fragments orbit + pain points ════════════════════════ */}
        <div id="s-chaos" style={{ height: "220vh" }}>
          <div className="sticky top-0 h-screen overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

              {/* Pain 1 — fragmentation */}
              <p
                data-pain
                className="absolute text-center font-black leading-[1.15] tracking-tighter text-white"
                style={{ fontSize: "clamp(1.7rem, 3.2vw, 3rem)", opacity: 0, maxWidth: "660px" }}
              >
                StudioBinder. Frame.io. HoneyBook. Slack.<br />
                <span className="text-white/45">Not one of them talks to the other.</span>
              </p>

              {/* Pain 2 — the financial drain */}
              <p
                data-pain
                className="absolute text-center font-black leading-[1.15] tracking-tighter text-white"
                style={{ fontSize: "clamp(1.7rem, 3.2vw, 3rem)", opacity: 0, maxWidth: "620px" }}
              >
                Subscription after subscription.<br />
                <span className="text-white/45">Something&apos;s always falling through the cracks.</span>
              </p>

              {/* Pain 3 — the client text, as a chat bubble */}
              <div
                data-pain
                className="absolute flex flex-col items-center gap-3"
                style={{ opacity: 0 }}
              >
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/30">
                  Sarah M.
                </p>
                <div
                  className="rounded-2xl rounded-tl-md px-6 py-4"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <p
                    className="font-semibold text-white"
                    style={{ fontSize: "clamp(1.2rem, 2.4vw, 2rem)" }}
                  >
                    &ldquo;hey are the videos done yet?&nbsp;👀&rdquo;
                  </p>
                </div>
                <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/22 mt-1">
                  No portal. Just your inbox.
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* ══ ENOUGH ══════════════════════════════════════════════════════ */}
        <div id="s-explode" style={{ height: "160vh" }}>
          <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-8 text-center">
            <div
              id="enough"
              data-split
              className="font-black leading-none tracking-tighter text-white"
              style={{ fontSize: "clamp(3.8rem, 9vw, 7.5rem)", overflow: "hidden", perspective: "800px" }}
            >
              ENOUGH.
            </div>
            <p
              id="enough-sub"
              className="mt-6 text-base font-light tracking-wide text-white/30"
              style={{ opacity: 0 }}
            >
              There&apos;s a better way.
            </p>
          </div>
        </div>

        {/* ══ CINEFLOW INTRO ══════════════════════════════════════════════ */}
        <div id="s-intro" style={{ height: "160vh" }}>
          <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-8 text-center">
            <div className="max-w-4xl">
              <div className="mb-7 flex justify-center">
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

              <p className="mb-4 font-mono text-[12px] tracking-[0.35em] uppercase text-[#d4a853]/60">
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
                className="mt-6 mx-auto max-w-sm text-sm leading-relaxed text-white/30"
                style={{ opacity: 0 }}
              >
                Everything your production runs on — finally in one place.
              </p>
            </div>
          </div>
        </div>

        {/* ══ PRODUCT PANELS — sticky cycling ═════════════════════════════ */}
        <div id="s-panels" style={{ height: "280vh" }}>
          <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
            {PANELS.map((panel, i) => (
              <div
                key={i}
                id={`panel-${i}`}
                className="absolute max-w-3xl px-8 text-center"
                style={{ opacity: i === 0 ? 1 : 0 }}
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

                <div className="mx-auto mb-5 h-px w-8 bg-[#d4a853]/25" />

                <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-white/30">
                  {panel.sub}
                </p>

                <p className="mt-5 font-mono text-[9px] tracking-[0.3em] uppercase text-white/15">
                  {panel.note}
                </p>
              </div>
            ))}
          </div>
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
              className="max-w-xl font-black leading-[1.04] tracking-tighter text-white"
              style={{ fontSize: "clamp(2.4rem, 5vw, 4.5rem)", overflow: "hidden" }}
            >
              Everything in one place. Finally.
            </div>

            <p
              data-cta
              className="text-[13px] text-white/25 max-w-xs leading-relaxed"
              style={{ opacity: 0 }}
            >
              Join filmmakers and video teams already running their productions on CineFlow.
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
              className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/20"
              style={{ opacity: 0 }}
            >
              Replaces a ton of subscriptions. Starts at $39/mo.
            </p>
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8 font-mono text-[9px] tracking-widest uppercase text-white/10">
            <Link href="/privacy" className="hover:text-white/30 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/30 transition-colors">Terms</Link>
            <span>© 2026 CineFlow</span>
          </div>
        </div>

      </div>
    </>
  );
}
