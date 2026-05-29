import { createClient } from "@supabase/supabase-js";
import { InviteLinksClient } from "./InviteLinksClient";
import { requireAdminPage } from "@/lib/admin-guard";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function InviteLinksPage() {
  await requireAdminPage();
  const supabase = getAdmin();
  const { data: links } = await supabase
    .from("invite_links")
    .select("id, code, plan, max_uses, uses, expires_at, notes, headline, badge_text, subtext, invitee_name, access_type, trial_days, is_active, created_at")
    .order("created_at", { ascending: false });

  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Invite Links</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Create and manage exclusive invite links — Founding Member, extended trials, or standard access</p>
        </div>
      </div>
      <InviteLinksClient links={links ?? []} appUrl={appUrl} />
    </div>
  );
}
