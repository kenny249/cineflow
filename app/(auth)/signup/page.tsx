import type { Metadata } from "next";
import Link from "next/link";
import { Film, Users, Ticket } from "lucide-react";
import { SignupForm } from "./SignupForm";
import { PageParticles } from "../login/PageParticles";
import { HeroPreview } from "../login/HeroPreview";
import { HexField } from "../login/HexField";

export const metadata: Metadata = { title: "Create Account" };

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
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 md:w-1/2 lg:w-2/5">
        <div className="animate-card-rise w-full max-w-sm rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 bg-card/95 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.25)] backdrop-blur-xl">
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
                  <p className="text-xs text-[#d4a853]">A friend invited you to CineFlow</p>
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

      {/* Right: Hero Preview */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden border-l border-border bg-[#070707] px-8 py-10 md:flex">
        <HexField />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        <div className="relative z-10 flex w-full items-center justify-center">
          <HeroPreview />
        </div>
      </div>
    </div>
  );
}
