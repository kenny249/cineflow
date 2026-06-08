import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// /r/[code] — short referral URL that redirects to /?ref=CODE after verifying the code exists

export default async function ReferralRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

  if (!clean) redirect("/");

  // Verify code exists (prevents spam/guessing showing the referral UI)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", clean)
    .maybeSingle();

  if (!data) redirect("/signup");

  redirect(`/?ref=${clean}`);
}
