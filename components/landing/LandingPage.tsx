"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { scrollState } from "./scrollState";

interface Props { refCode?: string }

const FRAGMENTS = [
  { text: '"where are we at?" · 11:47pm',     mono: false, x: "4%",  y: "20%", rot: -3, d: 0.6,  dur: 3.8 },
  { text: "Invoice_v4_FINAL_FINAL.pdf",        mono: true,  x: "70%", y: "16%", rot:  4, d: 1.0,  dur: 4.2 },
  { text: '"did you get the rough cut link?"', mono: false, x: "3%",  y: "60%", rot: -2, d: 1.2,  dur: 3.5 },
  { text: "shot_list_REVISED_use_this.xlsx",   mono: true,  x: "68%", y: "72%", rot:  5, d: 0.8,  dur: 4.5 },
  { text: '"can you resend the contract?"',    mono: false, x: "74%", y: "42%", rot: -4, d: 1.4,  dur: 3.9 },
  { text: "Client approval: pending 14d",      mono: false, x: "8%",  y: "80%", rot:  3, d: 1.0,  dur: 4.1 },
  { text: '"what time is call time again?"',   mono: false, x: "12%", y: "38%", rot: -5, d: 1.5,  dur: 3.6 },
  { text: "call_sheet_saturday_v4.pdf",        mono: true,  x: "58%", y: "24%", rot:  3, d: 0.9,  dur: 4.3 },
  { text: '"I never got the invoice 🙏"',      mono: false, x: "76%", y: "60%", rot: -3, d: 1.3,  dur: 3.7 },
  { text: '"just checking in again..."',       mono: false, x: "28%", y: "19%", rot:  2, d: 1.6,  dur: 4.0 },
] as const;

const PANELS = [
  {
    num: "01", tag: "Production",
    h: ["Your whole", "production.", "One view."] as const,
    sub: "Shot lists, call sheets, and scheduling — everything your crew needs, right where your project lives.",
    note: "Replaces StudioBinder + Notion",
  },
  {
    num: "02", tag: "Client Portal",
    h: ["Clients stay", "in the loop.", "Automatically."] as const,
    sub: "Every client gets their own portal. They see progress, approve cuts, and sign off — without texting you.",
    note: 'No more "hey, are the videos done yet?"',
  },
  {
    num: "03", tag: "Payments",
    h: ["Stop chasing", "your own", "money."] as const,
    sub: "Professional invoices, deposit collection, and automated reminders — right next to the project.",
    note: "Replaces HoneyBook + DocuSign",
  },
] as const;

export function LandingPage({ refCode }: Props) {
  const href = refCode ? `/signup?ref=${refCode}` : "/signup";

  useEffect(() => {
    let teardown: (() => void) | undefined;

    (async () => {
      const { default: Lenis } = await import("lenis");

      // Smooth scroll — no GSAP, no triggers, just buttery deceleration
      const lenis = new Lenis({ lerp: 0.10, smoothWheel: true });
      lenis.on("scroll", ({ progress }: { progress: number }) => {
        scrollState.prog = progress;
      });
      let rafId: number;
      function tick(t: number) { lenis.raf(t); rafId = requestAnimationFrame(tick); }
      rafId = requestAnimationFrame(tick);

      // Mouse parallax — makes the hero feel alive without any scroll dependency
      const frags = Array.from(document.querySelectorAll<HTMLElement>(".lp-frag-wrap"));
      function onMove(e: MouseEvent) {
        const x = e.clientX / window.innerWidth  - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        frags.forEach((el, i) => {
          const d = 0.28 + (i % 4) * 0.18;
          el.style.setProperty("--mpx", `${x * d * 18}px`);
          el.style.setProperty("--mpy", `${y * d * 12}px`);
        });
      }
      window.addEventListener("mousemove", onMove);

      // Scroll reveals — IntersectionObserver adds .is-visible, CSS does the rest
      const io = new IntersectionObserver(
        (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("is-visible"); }),
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
      );
      document.querySelectorAll("[data-reveal]").forEach(el => io.observe(el));

      teardown = () => {
        cancelAnimationFrame(rafId);
        lenis.destroy();
        window.removeEventListener("mousemove", onMove);
        io.disconnect();
      };
    })();

    return () => teardown?.();
  }, []);

  return (
    <>
      <BackgroundCanvas />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d4a853]/40 bg-[#d4a853]/10">
            <Film className="h-3.5 w-3.5 text-[#d4a853]" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white/90">CineFlow</span>
        </div>
        <Link
          href={href}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur-sm transition-all hover:border-[#d4a853]/50 hover:text-[#d4a853]"
        >
          Get early access
        </Link>
      </nav>

      <div className="relative z-20">

        {/* ══ HERO ══════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-8 text-center">

          {/* Chaos fragments — CSS float, no JS per frame */}
          {FRAGMENTS.map((f, i) => (
            <div
              key={i}
              className="lp-frag-wrap absolute pointer-events-none"
              style={{ left: f.x, top: f.y, "--fd": `${f.d}s`, "--fdur": `${f.dur}s` } as React.CSSProperties}
            >
              <div
                className="lp-frag-card rounded-md px-3 py-1.5 text-white/35"
                style={{
                  "--rot": `${f.rot}deg`,
                  fontSize: "11px",
                  fontFamily: f.mono ? "'SF Mono','Fira Code',monospace" : "inherit",
                  border: "1px solid rgba(255,255,255,0.055)",
                  background: "rgba(5,5,12,0.70)",
                  backdropFilter: "blur(8px)",
                  whiteSpace: "nowrap",
                  letterSpacing: f.mono ? "0.02em" : "-0.01em",
                } as React.CSSProperties}
              >
                {f.text}
              </div>
            </div>
          ))}

          {/* Hero content — staggered CSS keyframe load-in */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className="lp-hero-line mb-12 h-px w-56"
              style={{ background: "linear-gradient(90deg,transparent,rgba(212,168,83,0.42),transparent)" }}
            />
            <p className="lp-hero-kicker mb-5 text-[11px] font-medium tracking-[0.32em] uppercase text-white/28">
              For filmmakers and video production teams
            </p>
            <h1
              className="lp-hero-headline max-w-3xl font-sans font-black leading-[1.04] tracking-tighter text-white"
              style={{ fontSize: "clamp(2.2rem,4.2vw,3.8rem)" }}
            >
              Stop stitching your<br />production together.
            </h1>
            <p className="lp-hero-sub mt-6 max-w-sm text-[13px] leading-relaxed text-white/32">
              Shot lists, client portals, invoicing, crew scheduling —<br />all flowing in one place. Finally.
            </p>
            <Link
              href={href}
              className="lp-hero-cta mt-8 rounded-xl bg-[#d4a853] px-7 py-3 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_36px_rgba(212,168,83,0.35)]"
            >
              Start for free →
            </Link>
          </div>

          <div className="lp-hero-scroll absolute bottom-10 flex flex-col items-center gap-3">
            <div className="h-12 w-px bg-gradient-to-b from-transparent to-[#d4a853]/22" />
            <p className="font-mono text-[8px] tracking-[0.35em] text-white/14 uppercase">Scroll</p>
          </div>
        </section>

        {/* ══ PAIN ══════════════════════════════════════════════════════ */}
        <section className="relative flex flex-col items-center gap-20 py-28 px-8">

          <div data-reveal className="max-w-2xl text-center">
            <p className="mb-5 font-mono text-[10px] tracking-[0.42em] uppercase text-white/20">The problem</p>
            <p
              className="font-black leading-[1.14] tracking-tighter text-white"
              style={{ fontSize: "clamp(1.9rem,3.6vw,3.2rem)" }}
            >
              StudioBinder. Frame.io.<br />HoneyBook. Slack.
              <br /><span className="text-white/38">Not one of them talks to the other.</span>
            </p>
          </div>

          <div data-reveal className="max-w-2xl text-center">
            <p
              className="font-black leading-[1.14] tracking-tighter text-white"
              style={{ fontSize: "clamp(1.9rem,3.6vw,3.2rem)" }}
            >
              Subscription after subscription.
              <br /><span className="text-white/38">Something&apos;s always falling through the cracks.</span>
            </p>
          </div>

        </section>

        {/* ══ ENOUGH ════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-[65vh] items-center justify-center px-8 text-center">
          <div data-reveal="clip">
            <div
              className="lp-clip font-black leading-none tracking-tighter text-white"
              style={{ fontSize: "clamp(5rem,13vw,10rem)" }}
            >
              <div className="lp-clip-inner" style={{ "--di": "0s" } as React.CSSProperties}>ENOUGH.</div>
            </div>
            <div className="lp-clip mt-7">
              <p className="lp-clip-inner text-[12px] font-light tracking-[0.34em] uppercase text-white/24"
                style={{ "--di": "0.18s" } as React.CSSProperties}>
                There&apos;s a better way.
              </p>
            </div>
          </div>
        </section>

        {/* ══ CINEFLOW INTRO ════════════════════════════════════════════ */}
        <section className="relative flex min-h-[75vh] flex-col items-center justify-center px-8 text-center">
          <div data-reveal="clip" className="flex flex-col items-center">
            <div className="lp-clip mb-8">
              <div className="lp-clip-inner h-px w-10 bg-[#d4a853]" style={{ "--di": "0s" } as React.CSSProperties} />
            </div>
            <div className="lp-clip mb-5">
              <p className="lp-clip-inner font-mono text-[11px] tracking-[0.42em] uppercase text-[#d4a853]/55"
                style={{ "--di": "0.06s" } as React.CSSProperties}>
                Introducing
              </p>
            </div>
            <div className="lp-clip" style={{ fontSize: "clamp(4.5rem,14vw,12rem)" }}>
              <div
                className="lp-clip-inner font-black leading-none tracking-tighter"
                style={{
                  "--di": "0.14s",
                  background: "linear-gradient(135deg,#ffffff 34%,#d4a853 63%,#fff3c4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  display: "block",
                } as React.CSSProperties}
              >CineFlow</div>
            </div>
            <div className="lp-clip mt-7">
              <p className="lp-clip-inner mx-auto max-w-sm text-[13px] leading-relaxed text-white/28"
                style={{ "--di": "0.30s" } as React.CSSProperties}>
                Everything your production runs on — finally in one place.
              </p>
            </div>
          </div>
        </section>

        {/* ══ PANELS ════════════════════════════════════════════════════ */}
        <section className="relative py-20 px-8">
          <div className="mx-auto max-w-xl flex flex-col items-center gap-20">
            {PANELS.map((panel, i) => (
              <div
                key={i}
                data-reveal="clip"
                className="flex flex-col items-center text-center"
              >
                <div className="lp-clip mb-6">
                  <p className="lp-clip-inner font-mono text-[10px] tracking-[0.42em] uppercase text-[#d4a853]/48"
                    style={{ "--di": "0s" } as React.CSSProperties}>
                    {panel.num} — {panel.tag}
                  </p>
                </div>
                <div
                  className="font-black leading-[1.06] tracking-tighter text-white"
                  style={{ fontSize: "clamp(3rem,6.5vw,5.8rem)" }}
                >
                  <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0.08s" } as React.CSSProperties}>{panel.h[0]}</div></div>
                  <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0.16s" } as React.CSSProperties}>{panel.h[1]}</div></div>
                  <div className="lp-clip"><div className="lp-clip-inner text-[#d4a853]" style={{ "--di": "0.24s" } as React.CSSProperties}>{panel.h[2]}</div></div>
                </div>
                <div className="lp-clip my-7">
                  <div className="lp-clip-inner h-px w-8 bg-[#d4a853]/22" style={{ "--di": "0.30s" } as React.CSSProperties} />
                </div>
                <div className="lp-clip">
                  <p className="lp-clip-inner max-w-xs text-[13px] leading-relaxed text-white/28"
                    style={{ "--di": "0.36s" } as React.CSSProperties}>{panel.sub}</p>
                </div>
                <div className="lp-clip mt-5">
                  <p className="lp-clip-inner font-mono text-[9px] tracking-[0.32em] uppercase text-white/14"
                    style={{ "--di": "0.42s" } as React.CSSProperties}>{panel.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══ CTA ═══════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-8 text-center">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 52% 40% at 50% 52%,rgba(212,168,83,0.055) 0%,transparent 70%)" }}
          />
          <div data-reveal="clip" className="relative z-10 flex flex-col items-center gap-0">
            <div
              className="mb-5 font-black leading-[1.04] tracking-tighter text-white"
              style={{ fontSize: "clamp(2.4rem,5vw,4.5rem)" }}
            >
              <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0s" } as React.CSSProperties}>Everything in one place.</div></div>
              <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0.10s" } as React.CSSProperties}>Finally.</div></div>
            </div>
            <div className="lp-clip mb-5">
              <p className="lp-clip-inner max-w-xs text-[13px] leading-relaxed text-white/24"
                style={{ "--di": "0.20s" } as React.CSSProperties}>
                Join filmmakers and video teams already running their productions on CineFlow.
              </p>
            </div>
            <div className="lp-clip mb-5 mt-1">
              <Link
                href={href}
                className="lp-clip-inner block rounded-xl bg-[#d4a853] px-8 py-3.5 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(212,168,83,0.35)]"
                style={{ "--di": "0.30s" } as React.CSSProperties}
              >
                Start for free →
              </Link>
            </div>
            <div className="lp-clip">
              <p className="lp-clip-inner font-mono text-[9px] tracking-[0.32em] uppercase text-white/18"
                style={{ "--di": "0.38s" } as React.CSSProperties}>
                Replaces a ton of subscriptions. Starts at $39/mo.
              </p>
            </div>
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8 font-mono text-[9px] tracking-widest uppercase text-white/10">
            <Link href="/privacy" className="hover:text-white/30 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/30 transition-colors">Terms</Link>
            <span>© 2026 CineFlow</span>
          </div>
        </section>

      </div>
    </>
  );
}
