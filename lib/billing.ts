import type { Profile } from "@/types";

export const SEAT_LIMITS: Record<string, number> = {
  solo_beta: 1,
  studio_beta: 5,
  solo: 1,
  studio: 5,
  agency: 15,
  enterprise: 999,
  lifetime: 1,
};

// Plans that can invite project collaborators (Studio and above only)
const COLLABORATOR_PLANS = new Set(["studio", "studio_beta", "agency", "enterprise"]);

export function getSeatLimit(plan?: string | null): number {
  return SEAT_LIMITS[plan ?? ""] ?? 1;
}

export function canInviteCollaborators(plan?: string | null): boolean {
  return COLLABORATOR_PLANS.has(plan ?? "");
}

export function isTrialing(profile: Pick<Profile, "plan_status" | "trial_ends_at">): boolean {
  if (profile.plan_status !== "trialing") return false;
  if (!profile.trial_ends_at) return false;
  return new Date(profile.trial_ends_at) > new Date();
}

export function hasActiveAccess(profile: Pick<Profile, "plan" | "plan_status" | "trial_ends_at">): boolean {
  if (profile.plan === "lifetime") return true;
  if (profile.plan_status === "founding") return true;
  if (profile.plan_status === "active") return true;
  if (isTrialing(profile)) return true;
  return false;
}

export function trialDaysLeft(trialEndsAt?: string | null): number {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function isTrialExpired(profile: Pick<Profile, "plan_status" | "trial_ends_at">): boolean {
  if (profile.plan_status === "active") return false;
  if (!profile.trial_ends_at) return true;
  return new Date(profile.trial_ends_at) <= new Date();
}
