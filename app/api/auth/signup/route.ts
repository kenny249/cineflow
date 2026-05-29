import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, firstName, lastName, company, inviteCode, referredBy } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Validate invite code before creating the user
    let invitePlan: string | null = null;
    let inviteAccessType: string = "standard";
    let inviteTrialDays: number = 30;
    let inviteLinkId: string | null = null;
    let inviteCurrentUses = 0;
    if (inviteCode) {
      const { data: invite } = await supabase
        .from("invite_links")
        .select("id, plan, uses, max_uses, access_type, trial_days, is_active")
        .eq("code", (inviteCode as string).toUpperCase())
        .single();

      if (!invite || invite.is_active === false) {
        return NextResponse.json({ error: "Invalid or inactive invite code." }, { status: 400 });
      }
      if (invite.max_uses !== null && invite.uses >= invite.max_uses) {
        return NextResponse.json({ error: "This invite link has reached its maximum uses." }, { status: 400 });
      }
      invitePlan = invite.plan as string;
      inviteAccessType = (invite.access_type as string) ?? "standard";
      inviteTrialDays = (invite.trial_days as number) ?? 30;
      inviteLinkId = invite.id as string;
      inviteCurrentUses = invite.uses as number;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName ?? "",
        last_name: lastName ?? "",
        company: company ?? "",
        full_name: [firstName, lastName].filter(Boolean).join(" "),
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const userId = data.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // Build profile patch based on access type
    const profilePatch: Record<string, unknown> = {};

    if (inviteAccessType === "founding") {
      // Free forever — no trial, no Stripe needed
      profilePatch.plan_status = "founding";
      profilePatch.trial_ends_at = null;
    } else if (inviteAccessType === "trial" && inviteLinkId) {
      // Extended trial
      const trialEndsAt = new Date(Date.now() + inviteTrialDays * 24 * 60 * 60 * 1000).toISOString();
      profilePatch.plan_status = "trialing";
      profilePatch.trial_ends_at = trialEndsAt;
    } else {
      // Standard 30-day trial on Studio
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      profilePatch.plan_status = "trialing";
      profilePatch.trial_ends_at = trialEndsAt;
      profilePatch.plan = "studio";
    }

    if (invitePlan) profilePatch.plan = invitePlan;
    if (referredBy) profilePatch.referred_by = (referredBy as string).toUpperCase();

    // Attempt to assign a unique referral code (retry on collision)
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      const { error: patchErr } = await supabase
        .from("profiles")
        .update({ referral_code: code, ...profilePatch })
        .eq("id", userId);
      if (!patchErr) break;
    }

    // Increment invite link uses + record who used it
    if (inviteLinkId) {
      await supabase
        .from("invite_links")
        .update({ uses: inviteCurrentUses + 1 })
        .eq("id", inviteLinkId);
      await supabase.from("invite_link_uses").insert({
        invite_link_id: inviteLinkId,
        user_id: userId,
        email,
      });
    }

    return NextResponse.json({ ok: true, userId });
  } catch (err) {
    console.error("[api/auth/signup]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
