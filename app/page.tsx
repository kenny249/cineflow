import Link from "next/link";
import { ArrowRight, Film, Play, CheckCircle2, Layers, Calendar, Upload, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Layers,
    title: "Shot Lists & Storyboards",
    description:
      "Build detailed shot lists and visual storyboards. Assign shots, track completion, and communicate your vision with precision.",
  },
  {
    icon: Upload,
    title: "Revision Management",
    description:
      "Upload cuts, share with clients, and collect feedback on specific moments. Version control built for video production.",
  },
  {
    icon: Calendar,
    title: "Production Calendar",
    description:
      "Schedule shoot days, review sessions, and deliveries. Keep your entire production timeline in one place.",
  },
  {
    icon: MessageSquare,
    title: "Client Collaboration",
    description:
      "Invite clients to review and comment directly on revisions. No more email chains or scattered feedback.",
  },
];

const STATS = [
  { value: "2,400+", label: "Projects delivered" },
  { value: "380+", label: "Filmmakers & agencies" },
  { value: "94%", label: "On-time delivery rate" },
  { value: "4.9★", label: "Average rating" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6 md:px-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#d4a853]/10 border border-[#d4a853]/20">
            <Film className="h-3.5 w-3.5 text-[#d4a853]" />
          </div>
          <span className="font-display text-sm font-semibold tracking-tight">Cineflow</span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="#about" className="hover:text-foreground transition-colors">About</Link>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="gold" size="sm" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-16 text-center">
        {/* Background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Radial glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4a853]/4 blur-[120px]" />

        {/* Eyebrow */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d4a853]/20 bg-[#d4a853]/5 px-3 py-1 text-xs font-medium text-[#d4a853]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4a853] animate-pulse" />
          Built for filmmakers and video teams
        </div>

        {/* Headline */}
        <h1 className="font-display max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight text-foreground md:text-7xl">
          Craft Stories.{" "}
          <br />
          <span className="text-gradient-gold">Deliver Brilliance.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg leading-relaxed">
          Cineflow is the project management platform built for the way filmmakers
          and media agencies actually work — from first concept to final delivery.
        </p>

        <div className="mt-10 flex items-center gap-3">
          <Button variant="gold" size="lg" asChild className="gap-2">
            <Link href="/signup">
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="gap-2">
            <Link href="/dashboard">
              <Play className="h-4 w-4" />
              View demo
            </Link>
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Free 14-day trial · No credit card required
        </p>

        {/* App preview placeholder */}
        <div className="relative mt-16 w-full max-w-5xl">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-[#d4a853]/10 to-transparent blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
            {/* Fake browser bar */}
            <div className="flex h-9 items-center gap-1.5 border-b border-border px-4">
              <div className="h-2.5 w-2.5 rounded-full bg-border" />
              <div className="h-2.5 w-2.5 rounded-full bg-border" />
              <div className="h-2.5 w-2.5 rounded-full bg-border" />
              <div className="mx-auto flex h-5 w-48 items-center justify-center rounded bg-muted">
                <span className="text-[10px] text-muted-foreground">app.cineflow.io/dashboard</span>
              </div>
            </div>
            {/* Dashboard preview content */}
            <div className="flex h-[380px] bg-background">
              {/* Fake sidebar */}
              <div className="w-[180px] shrink-0 border-r border-border bg-card p-3">
                <div className="mb-4 flex items-center gap-2 px-2">
                  <div className="h-5 w-5 rounded bg-[#d4a853]/20" />
                  <div className="h-3 w-20 rounded bg-muted" />
                </div>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 ${i === 0 ? "bg-accent" : ""}`}>
                    <div className="h-3.5 w-3.5 rounded bg-muted" />
                    <div className="h-2.5 w-16 rounded bg-muted" />
                  </div>
                ))}
              </div>
              {/* Fake main content */}
              <div className="flex-1 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="h-5 w-32 rounded bg-muted" />
                  <div className="h-7 w-24 rounded-md bg-[#d4a853]/20" />
                </div>
                {/* Stat cards */}
                <div className="mb-5 grid grid-cols-3 gap-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-3">
                      <div className="mb-2 h-2.5 w-20 rounded bg-muted" />
                      <div className="h-6 w-12 rounded bg-muted" />
                    </div>
                  ))}
                </div>
                {/* Project cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
                      <div className="h-20 bg-muted" />
                      <div className="p-2.5">
                        <div className="mb-1.5 h-2.5 w-24 rounded bg-muted" />
                        <div className="h-2 w-16 rounded bg-muted" />
                        <div className="mt-2 h-1 w-full rounded-full bg-secondary">
                          <div
                            className="h-1 rounded-full bg-[#d4a853]/60"
                            style={{ width: `${[45, 78, 20][i]}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative border-y border-border py-14">
        <div className="letterbox-bar absolute top-0 left-0 right-0" />
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-display text-3xl font-bold text-gradient-gold md:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="letterbox-bar absolute bottom-0 left-0 right-0" />
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#d4a853]">
              Everything you need
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Production management, redesigned.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
              Every tool in Cineflow is built for how creative professionals actually work
              — not adapted from generic project management software.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-[#d4a853]/20 hover:bg-[#d4a853]/[0.02]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted group-hover:border-[#d4a853]/20 group-hover:bg-[#d4a853]/10 transition-all">
                  <feature.icon className="h-5 w-5 text-muted-foreground group-hover:text-[#d4a853] transition-colors" />
                </div>
                <h3 className="mb-2 font-display text-base font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Second row: wider feature highlight */}
          <div className="mt-4 rounded-xl border border-border bg-card p-8 md:p-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-center">
              <div className="flex-1">
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[#d4a853]">
                  From idea to delivery
                </p>
                <h3 className="mb-4 font-display text-2xl font-bold tracking-tight">
                  One platform for the full production arc.
                </h3>
                <ul className="space-y-2.5">
                  {[
                    "Pre-production planning & shot design",
                    "Production tracking & shoot management",
                    "Post-production revision workflows",
                    "Client delivery & approval",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d4a853]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="h-48 w-full rounded-xl bg-muted md:h-56 md:w-64 md:shrink-0 overflow-hidden">
                <div className="h-full w-full bg-gradient-to-br from-[#d4a853]/8 via-transparent to-transparent flex items-center justify-center">
                  <div className="text-center">
                    <Film className="mx-auto h-10 w-10 text-[#d4a853]/30 mb-2" />
                    <p className="text-xs text-muted-foreground">Project timeline</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="relative rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/[0.03] p-12 md:p-16">
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-[#d4a853]/5 to-transparent" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                Ready to deliver your best work?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Join 380+ filmmakers and agencies using Cineflow to run their productions.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button variant="gold" size="lg" asChild className="gap-2 w-full sm:w-auto">
                  <Link href="/signup">
                    Start free trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                  14 days free · Cancel anytime
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-10 px-6">
        <div className="mx-auto max-w-5xl flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#d4a853]/10 border border-[#d4a853]/20">
              <Film className="h-3 w-3 text-[#d4a853]" />
            </div>
            <span className="font-display text-sm font-semibold">Cineflow</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Cineflow. Built for filmmakers.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
