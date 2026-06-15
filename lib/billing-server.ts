import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { hasActiveAccess } from "./billing";
import type { Profile } from "@/types";

export async function requireActivePlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<NextResponse | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, plan_status, trial_ends_at")
    .eq("id", userId)
    .single();

  if (!profile || !hasActiveAccess(profile as Pick<Profile, "plan" | "plan_status" | "trial_ends_at">)) {
    return NextResponse.json(
      { error: "Your trial has expired. Please upgrade to continue using this feature." },
      { status: 402 }
    );
  }
  return null;
}
