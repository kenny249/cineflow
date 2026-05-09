import type { Metadata } from "next";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import RetainerPortalClient from "./RetainerPortalClient";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const supabase = getAdmin();

  const { data: retainer } = await supabase
    .from("retainers")
    .select("client_name, created_by")
    .eq("portal_token", token)
    .single();

  const { data: profile } = retainer
    ? await supabase
        .from("profiles")
        .select("business_name, company, full_name")
        .eq("id", retainer.created_by)
        .single()
    : { data: null };

  const clientName = retainer?.client_name ?? "Client Portal";
  const agencyName = profile?.business_name || profile?.company || profile?.full_name || "Studio";
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://usecineflow.com";
  const ogImage = `${appUrl}/api/og/retainer/${token}`;

  return {
    title: `${clientName} · Retainer Portal`,
    description: `Monthly delivery progress for ${clientName}, managed by ${agencyName}.`,
    openGraph: {
      title: `${clientName} · Retainer Portal`,
      description: `Monthly delivery progress managed by ${agencyName}.`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${clientName} retainer portal` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${clientName} · Retainer Portal`,
      images: [ogImage],
    },
    // Don't index client portals
    robots: { index: false, follow: false },
  };
}

export default function RetainerPortalPage() {
  return <RetainerPortalClient />;
}
