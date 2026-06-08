import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailTrialExpiring } from "@/lib/email-templates";

// Runs daily at 10 AM UTC (vercel.json schedule).
// Sends trial expiry reminder emails at 7 days, 3 days, and 1 day before trial ends.
// Uses profiles.trial_reminders_sent TEXT[] to avoid duplicate sends.

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = getAdmin();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@usecineflow.com";
  const fromName = "CineFlow";

  const now = new Date();

  // Find all active trialing users whose trial hasn't ended yet
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, trial_ends_at, trial_reminders_sent")
    .eq("plan_status", "trialing")
    .not("trial_ends_at", "is", null)
    .gt("trial_ends_at", now.toISOString())
    .not("email", "is", null);

  if (error) {
    console.error("[cron/trial-reminders] fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const CHECKPOINTS = [
    { key: "7d", daysLeft: 7 },
    { key: "3d", daysLeft: 3 },
    { key: "1d", daysLeft: 1 },
  ];

  let sent = 0;
  let skipped = 0;

  for (const user of users ?? []) {
    if (!user.email || !user.trial_ends_at) continue;

    const trialEnd = new Date(user.trial_ends_at);
    const msLeft = trialEnd.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    const alreadySent: string[] = user.trial_reminders_sent ?? [];
    const newlySent: string[] = [];

    for (const cp of CHECKPOINTS) {
      // Send when daysLeft is within ±0.5 days of the checkpoint
      if (daysLeft > cp.daysLeft + 0.5 || daysLeft < cp.daysLeft - 0.5) continue;
      if (alreadySent.includes(cp.key)) { skipped++; continue; }

      try {
        const { subject, html } = emailTrialExpiring({
          firstName: user.first_name ?? "",
          daysLeft: cp.daysLeft,
          upgradeUrl: `${appUrl}/upgrade`,
        });

        const { error: emailErr } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [user.email],
          subject,
          html,
        });

        if (!emailErr) {
          newlySent.push(cp.key);
          sent++;
        } else {
          console.warn(`[cron/trial-reminders] email failed for ${user.id} (${cp.key}):`, emailErr.message);
        }
      } catch (e) {
        console.error(`[cron/trial-reminders] send error for ${user.id} (${cp.key}):`, e);
      }
    }

    if (newlySent.length > 0) {
      await supabase
        .from("profiles")
        .update({ trial_reminders_sent: [...alreadySent, ...newlySent] })
        .eq("id", user.id);
    }
  }

  console.log(`[cron/trial-reminders] processed=${users?.length ?? 0} sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ processed: users?.length ?? 0, sent, skipped });
}
