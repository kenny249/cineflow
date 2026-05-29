"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Film, Lock, Zap } from "lucide-react";
import { hasActiveAccess } from "@/lib/billing";
import type { Profile } from "@/types";

const ALLOWED_PATHS = ["/upgrade", "/settings", "/login"];

interface Props {
  plan: string;
  planStatus: string;
  trialEndsAt: string | null;
  children: React.ReactNode;
}

export function TrialExpiredGate({ plan, planStatus, trialEndsAt, children }: Props) {
  const pathname = usePathname();

  const profile = { plan, plan_status: planStatus, trial_ends_at: trialEndsAt } as Pick<Profile, "plan" | "plan_status" | "trial_ends_at">;
  const hasAccess = hasActiveAccess(profile);
  const isAllowedPath = ALLOWED_PATHS.some((p) => pathname.startsWith(p));

  if (hasAccess || isAllowedPath) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060606]/95 backdrop-blur-sm">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[400px] w-[400px] rounded-full bg-[#d4a853]/[0.06] blur-[120px]" />
      </div>

      <div className="relative mx-4 w-full max-w-md">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-8 shadow-2xl">
          {/* Icon */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/10">
              <Film className="h-5 w-5 text-[#d4a853]" />
            </div>
            <span className="text-sm font-bold tracking-[0.2em] text-[#d4a853] uppercase">CineFlow</span>
          </div>

          {/* Heading */}
          <div className="mb-2 flex items-center gap-2">
            <Lock className="h-4 w-4 text-zinc-500" />
            <h2 className="text-lg font-bold text-white">Your free trial has ended</h2>
          </div>
          <p className="mb-8 text-sm text-zinc-400 leading-relaxed">
            You had full Studio access during your trial. Choose a plan to keep your projects, clients, and everything you&apos;ve built.
          </p>

          {/* CTA */}
          <Link
            href="/upgrade"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3.5 text-sm font-bold text-black transition-all hover:bg-[#e0b55e] active:scale-[0.98]"
          >
            <Zap className="h-4 w-4" />
            Choose a plan
          </Link>

          {/* Settings link */}
          <p className="mt-4 text-center text-xs text-zinc-600">
            Need to update billing?{" "}
            <Link href="/settings" className="text-zinc-400 underline underline-offset-4 hover:text-white transition-colors">
              Go to settings
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
