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

        // ── Hero — cascade in on load (section is at top so triggers fire immediately) ──
        gsap.fromTo("#hero-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 1.8, ease: "expo.inOut",
            scrollTrigger: { trigger: "#s-hero", start: "top 80%", toggleActions: "play none none none" } }
        );
        gsap.fromTo("#hero-kicker", { opacity: 0 },
          { opacity: 1, duration: 1.1, ease: "power2.out",
            scrollTrigger: { trigger: "#s-hero", start: "top 80%", toggleActions: "play none none none" } }
        );
        gsap.fromTo("#hero-headline", { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", delay: 0.15,
            scrollTrigger: { trigger: "#s-hero", start: "top 80%", toggleActions: "play none none none" } }
        );
        gsap.fromTo("#hero-sub", { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, ease: "power3.out", delay: 0.35,
            scrollTrigger: { trigger: "#s-hero", start: "top 80%", toggleActions: "play none none none" } }
        );
        gsap.fromTo("#hero-cta", { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", delay: 0.55,
            scrollTrigger: { trigger: "#s-hero", start: "top 80%", toggleActions: "play none none none" } }
        );

        // ── Fragment orbit — time-based ───────────────────────────────────────
        const cardEls = cardRefs.current.filter(Boolean) as HTMLDivElement[];
        gsap.set(cardEls, { opacity: 0 });

        orbitTickerFn = () => {
          if (orbit.opacity < 0.005) return;
          orbitTime += 0.004;
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

        // ── Chaos: orbit + pain points driven by a single trigger ─────────────
        // Orbit starts only once chaos pins — no bleed into the hero.
        // Pain 0 appears immediately; each point gets generous dwell (section is 200vh).
        const painEls = Array.from(document.querySelectorAll<HTMLElement>("[data-pain]"));
        gsap.set(painEls, { opacity: 0, filter: "blur(8px)", y: 12 });

        ScrollTrigger.create({
          trigger: "#s-chaos",
          start: "top top",
          end: "bottom top",
          onUpdate: (st) => {
            const p = st.progress;
            // Orbit fades in immediately when pinned, fades out at the very end
            orbit.opacity = smoothStep(0, 0.06, p) * (1 - smoothStep(0.90, 1.0, p));
            orbit.r = smoothStep(0, 0.08, p);
            // Two pain points — each gets ~half the 200vh section (~100vh hold)
            const v0 = smoothStep(0.00, 0.04, p) * (1 - smoothStep(0.42, 0.50, p));
            const v1 = smoothStep(0.50, 0.55, p) * (1 - smoothStep(0.92, 0.98, p));
            const y0 = 12 - smoothStep(0.00, 0.50, p) * 24;
            const y1 = 12 - smoothStep(0.50, 0.98, p) * 24;
            gsap.set(painEls[0], { opacity: v0, filter: `blur(${(1 - v0) * 6}px)`, y: y0 });
            gsap.set(painEls[1], { opacity: v1, filter: `blur(${(1 - v1) * 6}px)`, y: y1 });
          },
        });

        // ── ENOUGH — scrub reveal: plays AS section scrolls into view ─────────
        // Animation is fully complete by the time the section pins.
        // No black gap, no waiting.
        const enoughChars = document.querySelectorAll<HTMLElement>("#enough .char");
        if (enoughChars.length) {
          gsap.set(enoughChars, { y: 48, opacity: 0, rotationX: -40 });
          const enoughTl = gsap.timeline({ paused: true });
          enoughTl.to(enoughChars, {
            y: 0, opacity: 1, rotationX: 0, stagger: 0.06, duration: 0.8, ease: "none",
          });
          enoughTl.to("#enough-sub", { y: 0, opacity: 1, duration: 0.3, ease: "none" }, "-=0.15");
          ScrollTrigger.create({
            trigger: "#s-explode", start: "top bottom", end: "top top",
            scrub: 0.5, animation: enoughTl,
          });
        }

        // ── CineFlow intro — scrub reveal: plays AS section scrolls into view ──
        const cineChars = document.querySelectorAll<HTMLElement>("#cineflow-word .char");
        if (cineChars.length) {
          gsap.set(cineChars, { y: 70, opacity: 0, skewX: 5 });
          gsap.set("#intro-sub", { y: 10, opacity: 0 });
          const introTl = gsap.timeline({ paused: true });
          introTl.fromTo("#intro-line", { scaleX: 0 }, { scaleX: 1, duration: 0.15, ease: "none" }, 0);
          introTl.to(cineChars, {
            y: 0, opacity: 1, skewX: 0, stagger: 0.01, duration: 0.75, ease: "none",
          }, 0.1);
          introTl.to("#intro-sub", { y: 0, opacity: 1, duration: 0.25, ease: "none" }, 0.85);
          ScrollTrigger.create({
            trigger: "#s-intro", start: "top bottom", end: "top top",
            scrub: 0.5, animation: introTl,
          });
        }

        // ── Sticky cycling panels — directional scroll transitions ─────────────
        // Old panel exits UPWARD while new panel rises from BELOW, matching the
        // natural scroll direction. No blur on text — clean sharp crossfade.
        // 300vh total: each panel gets ~90vh of read time before transition.
        gsap.set("#panel-0", { opacity: 1, y: 0 });
        gsap.set("#panel-1", { opacity: 0, y: 45 });
        gsap.set("#panel-2", { opacity: 0, y: 45 });

        ScrollTrigger.create({
          trigger: "#s-panels",
          start: "top top",
          end: "bottom top",
          onUpdate: (st) => {
            const p = st.progress;
            // t01: panel 0→1 crossfade at 30-40%  (90vh hold before, 30vh transition)
            // t12: panel 1→2 crossfade at 65-75%  (75vh hold, 30vh transition, 75vh hold)
            const t01 = smoothStep(0.30, 0.40, p);
            const t12 = smoothStep(0.65, 0.75, p);

            const op0 = 1 - t01;
            const op1 = t01 * (1 - t12);
            const op2 = t12;

            // Directional Y: exiting panel floats up (-40px), entering rises from below (+45px)
            const y0 = -t01 * 40;
            const y1 = 45 * (1 - t01) - 35 * t12;
            const y2 = 45 * (1 - t12);

            gsap.set("#panel-0", { opacity: op0, y: y0 });
            gsap.set("#panel-1", { opacity: op1, y: y1 });
            gsap.set("#panel-2", { opacity: op2, y: y2 });
          },
        });

        // ── CTA ───────────────────────────────────────────────────────────────
        const ctaChars = document.querySelectorAll<HTMLElement>("#cta-headline .char");
        if (ctaChars.length) {
          gsap.set(ctaChars, { y: 50, opacity: 0 });
          gsap.to(ctaChars, {
            y: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.02,
            scrollTrigger: { trigger: "#s-cta", start: "top 80%", toggleActions: "play none none none" },
          });
        }
        document.querySelectorAll<HTMLElement>("[data-cta]").forEach((el, i) => {
          gsap.fromTo(el,
            { y: 14, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
              scrollTrigger: { trigger: "#s-cta", start: "top 72%", toggleActions: "play none none none" },
              delay: 0.38 + i * 0.12,
            }
          );
        });

      });

      // Two-pass refresh: first catches Splitting DOM changes, second catches font-load layout shift
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        setTimeout(() => ScrollTrigger.refresh(), 300);
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
            className="max-w-3xl font-sans font-black leading-[1.05] tracking-tighter text-white"
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

          <div className="absolute bottom-10 flex flex-col items-center gap-3 animate-float-slow">
            <div className="h-12 w-px bg-gradient-to-b from-transparent to-[#d4a853]/25" />
            <p className="font-mono text-[8px] tracking-[0.35em] text-white/15 uppercase">Scroll</p>
          </div>
        </section>

        {/* ══ CHAOS — fragments orbit + pain points ════════════════════════ */}
        <div id="s-chaos" style={{ height: "200vh" }}>
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


            </div>
          </div>
        </div>

        {/* ══ ENOUGH ══════════════════════════════════════════════════════ */}
        <div id="s-explode" style={{ height: "108vh" }}>
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
        <div id="s-intro" style={{ height: "108vh" }}>
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
        <div id="s-panels" style={{ height: "300vh" }}>
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
