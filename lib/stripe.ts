import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export const PLANS = {
  solo: {
    name: "Solo",
    seats: 1,
    monthly: process.env.STRIPE_PRICE_SOLO_MONTHLY!,
    annual: process.env.STRIPE_PRICE_SOLO_ANNUAL!,
  },
  studio: {
    name: "Studio",
    seats: 5,
    monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY!,
    annual: process.env.STRIPE_PRICE_STUDIO_ANNUAL!,
  },
  agency: {
    name: "Agency",
    seats: 15,
    monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY!,
    annual: process.env.STRIPE_PRICE_AGENCY_ANNUAL!,
  },
  enterprise: {
    name: "Enterprise",
    seats: 999,
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY!,
    annual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL!,
  },
  lifetime: {
    name: "Lifetime",
    seats: 1,
    monthly: null,
    annual: null,
    oneTime: process.env.STRIPE_PRICE_LIFETIME!,
  },
} as const;

export type StripePlanKey = keyof typeof PLANS;

export function getPlanByPriceId(priceId: string): StripePlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (
      plan.monthly === priceId ||
      plan.annual === priceId ||
      ("oneTime" in plan && plan.oneTime === priceId)
    ) {
      return key as StripePlanKey;
    }
  }
  return null;
}
