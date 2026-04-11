import type { Metadata } from "next";
import Link from "next/link";
import { Film, Clapperboard, GitBranch, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignupForm } from "./SignupForm";
import { PageParticles } from "../login/PageParticles";

export const metadata: Metadata = { title: "Create Account" };

const FEATURES = [
  {
    icon: Clapperboard,
    label: "Shot Lists & Storyboards",
    desc: "Build frame-perfect shot lists and visual storyboards in minutes.",
  },
  {
    icon: GitBranch,
    label: "Revision Workflows",
    desc: "Track every cut, note, and approval, with no more email chains.",
  },
  {
    icon: Users,
    label: "Client Portals",
    desc: "Give clients a private space to review and approve deliverables.",
  },
];

const TESTIMONIAL = {
  quote: "We delivered 3 campaigns last quarter without a single missed deadline.",
  author: "Marcus Reid",
  title: "Director, Focal Point Films",
};

export default function SignupPage() {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <PageParticles />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,168,83,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(212,168,83,0.06),transparent_35%)]" />
      <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-[#d4a853]/10 blur-3xl" />
      <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-[#d4a853]/8 blur-3xl" />

      {/* Left: Signup Form */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-12 md:w-1/2 lg:w-2/5">
        <div className="animate-card-rise w-full max-w-sm rounded-[2rem] border border-white/10 bg-card/95 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className="mb-7">
            <Link href="/" className="mb-5 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
                <Film className="h-3.5 w-3.5 text-[#d4a853]" />
              </div>
              <p className="text-[0.65rem] font-bold tracking-[0.3em] text-[#d4a853] uppercase">CineFlow</p>
            </Link>
            <h2 className="text-xl font-bold text-foreground">Start your free trial</h2>
            <p className="text-sm text-muted-foreground mt-1">14 days free. No credit card. Cancel anytime.</p>
          </div>

          <SignupForm />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">or</span>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2" size="lg">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign up with Google
          </Button>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:text-[#d4a853] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Premium Visual Panel */}
      <div className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden border-l border-border bg-[#070707] px-10 py-10 md:flex">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-[#d4a853]/7 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-[#d4a853]/5 blur-[80px]" />

        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 max-w-sm w-full">
          {/* Eyebrow */}
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#d4a853]">
            What&apos;s included
          </p>
          <h2 className="mb-8 font-display text-2xl font-bold leading-snug text-foreground">
            Everything you need to run a production.
          </h2>

          {/* Feature cards */}
          <div className="space-y-3 mb-8">
            {FEATURES.map(({ icon: Icon, label, desc }, i) => (
              <div
                key={label}
                className="group/card flex items-start gap-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4 transition-all duration-300 hover:border-[#d4a853]/25 hover:bg-white/[0.05]"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/10 transition-all duration-300 group-hover/card:shadow-[0_0_16px_4px_rgba(212,168,83,0.3)]">
                  <Icon className="h-4 w-4 text-[#d4a853]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-5">
            <div className="mb-3 flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-[#d4a853] text-[#d4a853]" />
              ))}
            </div>
            <p className="font-display text-sm font-semibold leading-relaxed text-foreground">
              &ldquo;{TESTIMONIAL.quote}&rdquo;
            </p>
            <div className="mt-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d4a853]/15 border border-[#d4a853]/20">
                <span className="text-[0.6rem] font-bold text-[#d4a853]">MR</span>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">{TESTIMONIAL.author}</p>
                <p className="text-[0.65rem] text-muted-foreground">{TESTIMONIAL.title}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
