import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { Film, Sparkles, Check, Clock } from "lucide-react";
import { InviteSignupForm } from "./InviteSignupForm";

export const metadata: Metadata = { title: "You're invited to CineFlow" };

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const PLAN_PERKS: Record<string, string[]> = {
  solo:     ["Shot lists & call sheets", "Client portals & approvals", "Invoicing & payments", "30-day free trial"],
  studio:   ["Everything in Solo", "Up to 5 team members", "Crew scheduling", "Multi-project management"],
  agency:   ["Everything in Studio", "Up to 15 team members", "Advanced analytics", "Priority support"],
  lifetime: ["Full Studio access", "Shot lists, scheduling & invoicing", "Client portals & crew management", "Yours forever"],
};

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = getAdmin();

  const { data: link } = await supabase
    .from("invite_links")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  const valid =
    link &&
    link.is_active !== false &&
    (link.max_uses === null || link.uses < link.max_uses) &&
    (!link.expires_at || new Date(link.expires_at) > new Date());

  if (!valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#080808] px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 mb-6">
          <Film className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">This invitation is no longer valid</h1>
        <p className="text-sm text-zinc-500 text-center max-w-xs">
          This invite link has expired or has already been used. Reach out to the person who shared it for a new one.
        </p>
        <Link href="/login" className="mt-6 text-sm text-zinc-500 hover:text-white transition-colors">
          Back to sign in →
        </Link>
      </div>
    );
  }

  const inviteeName = link.invitee_name as string | null;
  const firstName = inviteeName?.split(" ")[0] ?? null;
  const badgeText = (link.badge_text as string | null) ?? "Founding Member";
  const headline = (link.headline as string | null) ?? "You've been personally invited to CineFlow";
  const subtext = (link.subtext as string | null) ?? "Exclusive access. No credit card. No catch.";
  const plan = (link.plan as string) ?? "studio";
  const accessType = (link.access_type as string) ?? "founding";
  const trialDays = (link.trial_days as number) ?? 30;
  const spotsLeft = link.max_uses ? (link.max_uses as number) - (link.uses as number) : null;

  const perks = PLAN_PERKS[plan] ?? PLAN_PERKS.studio;
  const planLabel = plan === "solo" ? "Solo" : plan === "agency" ? "Agency" : plan === "lifetime" ? "Lifetime" : "Studio";
  const accessLabel = accessType === "founding"
    ? "Free forever — no card, no catch"
    : accessType === "trial"
    ? `${trialDays}-day free trial included`
    : "30-day free trial included";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080808] px-4 py-12">
      {/* Animated background glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/3 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4a853]/5 blur-[160px]" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-[#d4a853]/4 blur-[120px]" />
        <div className="absolute left-0 top-0 h-64 w-64 rounded-full bg-[#d4a853]/3 blur-[100px]" />
      </div>

      {/* Stars */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.sin(i * 2.4) * 50 + 50}%`,
              top: `${Math.cos(i * 1.7) * 50 + 50}%`,
              width: `${1 + (i % 3) * 0.5}px`,
              height: `${1 + (i % 3) * 0.5}px`,
              opacity: 0.04 + (i % 7) * 0.02,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* CineFlow wordmark */}
        <div className="mb-8 flex justify-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/10">
              <Film className="h-4 w-4 text-[#d4a853]" />
            </div>
            <span className="text-[0.65rem] font-black tracking-[0.35em] text-[#d4a853] uppercase">CineFlow</span>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          {/* Left — Invite details */}
          <div className="flex flex-col justify-center">
            {/* Badge */}
            <div className="mb-6">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em]"
                style={{
                  background: "linear-gradient(135deg, #1c1a0f 0%, #0e0d08 55%, #1a180e 100%)",
                  boxShadow: "0 0 0 1px rgba(212,168,83,0.5), 0 0 40px rgba(212,168,83,0.12), inset 0 1px 0 rgba(212,168,83,0.15)",
                }}
              >
                <Sparkles className="h-3 w-3 text-[#d4a853]" />
                <span
                  style={{
                    background: "linear-gradient(90deg, #a0720a, #f0c84a, #d4a853, #f5d98e, #b8860b)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {badgeText}
                </span>
              </span>
            </div>

            {/* Headline */}
            <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-white lg:text-5xl">
              {firstName ? (
                <>
                  {firstName},{" "}
                  <span
                    style={{
                      background: "linear-gradient(135deg, #ffffff 30%, #d4a853 65%, #fff3c4 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    you&apos;ve been
                  </span>
                  <br />personally invited.
                </>
              ) : (
                <>
                  <span
                    style={{
                      background: "linear-gradient(135deg, #ffffff 30%, #d4a853 65%, #fff3c4 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {headline}
                  </span>
                </>
              )}
            </h1>

            <p className="mb-8 text-base text-zinc-400 leading-relaxed max-w-sm">
              {subtext}
            </p>

            {/* What you get */}
            <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4a853]">{planLabel} plan — what&apos;s included</span>
              </div>
              <ul className="space-y-2.5">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/15 border border-[#d4a853]/30">
                      <Check className="h-2.5 w-2.5 text-[#d4a853]" />
                    </span>
                    {perk}
                  </li>
                ))}
                <li className="flex items-center gap-2.5 text-sm font-semibold text-[#d4a853]">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/20 border border-[#d4a853]/40">
                    <Sparkles className="h-2.5 w-2.5 text-[#d4a853]" />
                  </span>
                  {accessLabel}
                </li>
              </ul>
            </div>

            {/* Spots remaining */}
            {spotsLeft !== null && spotsLeft <= 10 && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                <span>Only {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} remaining</span>
              </div>
            )}
          </div>

          {/* Right — Signup card */}
          <div
            className="rounded-[1.75rem] border p-7"
            style={{
              background: "linear-gradient(135deg, rgba(17,16,16,0.98) 0%, rgba(13,12,12,0.98) 100%)",
              borderColor: "rgba(212,168,83,0.2)",
              boxShadow: "0 0 0 1px rgba(212,168,83,0.08), 0 32px 80px rgba(0,0,0,0.5), 0 0 60px rgba(212,168,83,0.06)",
            }}
          >
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white">
                {inviteeName ? `Welcome, ${firstName ?? inviteeName}` : "Claim your invitation"}
              </h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                {accessType === "founding" ? "Free forever. No credit card needed." : `${trialDays}-day free trial. No credit card.`}
              </p>
            </div>

            <InviteSignupForm
              inviteCode={code.toUpperCase()}
              accessType={accessType}
              invitePlan={plan}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
