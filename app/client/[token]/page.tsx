import type { Metadata } from "next";
import ClientPortalPage from "./ClientPortalPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: portal } = await admin
      .from("client_portals")
      .select("client_name")
      .eq("token", token)
      .eq("is_active", true)
      .single();
    if (portal?.client_name) {
      return {
        title: `${portal.client_name} – Content Library | Cineflow`,
        description: "Your delivered videos, organized and ready to view or download.",
        openGraph: {
          title: `${portal.client_name} – Content Library`,
          description: "Your delivered videos, organized and ready to view or download.",
          siteName: "Cineflow",
        },
      };
    }
  } catch {}

  return {
    title: "Client Content Library | Cineflow",
    description: "Your delivered videos, organized and ready to view or download.",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClientPortalPage token={token} />;
}
