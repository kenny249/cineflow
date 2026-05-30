import { requireAdminPage } from "@/lib/admin-guard";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { BrandClient } from "./BrandClient";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function BrandPage() {
  await requireAdminPage();

  const admin = getAdmin();
  const { data: files } = await admin.storage.from("brand-assets").list("uploads", {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });

  const initialAssets = (files ?? [])
    .filter((f) => f.name !== ".emptyFolderPlaceholder")
    .map((f) => {
      const path = `uploads/${f.name}`;
      const { data: { publicUrl } } = admin.storage.from("brand-assets").getPublicUrl(path);
      return { name: f.name, path, url: publicUrl, size: f.metadata?.size ?? 0, type: f.metadata?.mimetype ?? "" };
    });

  return <BrandClient initialAssets={initialAssets} />;
}
