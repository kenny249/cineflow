import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage, type HeroVariant } from "@/components/landing/LandingPage";

const HERO_VARIANTS: readonly HeroVariant[] = ["a", "b", "c", "d"];

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; h?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const { ref, h } = await searchParams;
  const heroVariant = HERO_VARIANTS.includes(h as HeroVariant) ? (h as HeroVariant) : "a";
  return <LandingPage refCode={ref} heroVariant={heroVariant} />;
}
