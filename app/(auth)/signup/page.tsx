import type { Metadata } from "next";
import Link from "next/link";
import { Film, Clapperboard, GitBranch, Users, DollarSign, Ticket } from "lucide-react";
import { SignupForm } from "./SignupForm";
import { PageParticles } from "../login/PageParticles";

export const metadata: Metadata = { title: "Create Account" };

const FEATURES = [
  {
    icon: Clapperboard,
    label: "Shot Lists & Call Sheets",
    desc: "Build frame-perfect shot lists and call sheets your crew can actually use.",
  },
  {
    icon: GitBranch,
    label: "Client Portals",
    desc: "Clients review, approve, and sign off — without texting you.",
  },
  {
    icon: Users,
    label: "Crew Scheduling",
    desc: "Multi-day shoot scheduling with locations, roles, and notes in one place.",
  },
  {
    icon: DollarSign,
    label: "Invoicing & Payments",
    desc: "Professional invoices, deposits, and automated reminders — right next to the project.",
  },
];

const PLAN_LABELS: Record<string, string> = {
  solo: "Solo",
  studio: "Studio",
  agency: "Agency",
  lifetime: "Lifetime",
  beta: "Beta",
};

type SearchParams = Promise<{ invite?: string; plan?: string; ref?: string }>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const { invite, plan, ref } = await searchParams;

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

            {invite ? (
              <>
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/8 px-3 py-2">
                  <Ticket className="h-3.5 w-3.5 shrink-0 text-[#d4a853]" />
                  <p className="text-xs text-[#d4a853]">
                    {plan && PLAN_LABELS[plan]
                      ? `${PLAN_LABELS[plan]} access unlocked via invite`
                      : "Invite code applied"}
                  </p>
                </div>
                <h2 className="text-xl font-bold text-foreground">You&apos;ve been invited</h2>
                <p className="text-sm text-muted-foreground mt-1">Create your account to get started.</p>
              </>
            ) : ref ? (
              <>
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/8 px-3 py-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-[#d4a853]" />
                  <p className="text-xs text-[#d4a853]">A friend invited you to Cineflow</p>
                </div>
                <h2 className="text-xl font-bold text-foreground">You&apos;ve been referred</h2>
                <p className="text-sm text-muted-foreground mt-1">Create your free account and get started today.</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-foreground">Start your free trial</h2>
                <p className="text-sm text-muted-foreground mt-1">30 days free. No credit card. Cancel anytime.</p>
              </>
            )}
          </div>

          <SignupForm inviteCode={invite} referredBy={ref} />
        </div>
      </div>

      {/* Right: Premium Visual Panel */}
      <div className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden border-l border-white/[0.06] px-10 py-10 md:flex">
        {/* Soft gold atmosphere */}
        <div className="pointer-events-none absolute left-1/2 top-1/4 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#d4a853]/8 blur-[140px]" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-[#d4a853]/6 blur-[100px]" />
        <div className="pointer-events-none absolute left-0 top-0 h-64 w-64 rounded-full bg-[#d4a853]/4 blur-[80px]" />

        <div className="relative z-10 max-w-sm w-full">
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#d4a853]">
            What&apos;s included
          </p>
          <h2 className="mb-8 font-display text-2xl font-bold leading-snug text-foreground">
            Everything you need to run a production.
          </h2>

          <div className="space-y-3">
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
        </div>
      </div>
    </div>
  );
}
