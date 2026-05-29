import { createClient } from "@supabase/supabase-js";
import { requireAdminPage } from "@/lib/admin-guard";
import { AnnouncementsClient } from "./AnnouncementsClient";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function AnnouncementsPage() {
  await requireAdminPage();
  const supabase = getAdmin();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, message, type, is_active, plans, starts_at, ends_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Announcements</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Banners shown to all users in the app</p>
      </div>
      <AnnouncementsClient initial={announcements ?? []} />
    </div>
  );
}
