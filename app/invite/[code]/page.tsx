import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Film, Crown } from "lucide-react";

export const metadata: Metadata = { title: "You're invited to Cineflow" };

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = getAdmin();

  const { data: link } = await supabase
    .from("invite_links")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  const valid = link && link.uses < link.max_uses && (!link.expires_at || new Date(link.expires_at) > new Date());

  if (!valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#080808] px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 mb-6">
          <Film className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">This link is no longer valid</h1>
        <p className="text-sm text-zinc-500 text-center max-w-xs">
          This invite link has expired or has already been used. Contact the person who sent it to you for a new one.
        </p>
        <Link href="/login" className="mt-6 text-sm text-zinc-500 hover:text-white transition-colors">
          Back to sign in →
        </Link>
      </div>
    );
  }

  // Redirect to signup with the invite code as a query param so SignupForm can capture it
  redirect(`/signup?invite=${code.toUpperCase()}&plan=${link.plan}`);
}
