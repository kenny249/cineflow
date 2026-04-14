import type { Metadata } from "next";
import FormClient from "./FormClient";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://usecineflow.com";

// Fetch form + agency data for OG tags (server-side, no auth needed)
async function getFormMeta(token: string) {
  try {
    const res = await fetch(`${APP_URL}/api/forms/${token}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<{
      form: { title: string; description?: string };
      agency: { name: string };
    }>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await getFormMeta(token);

  const agencyName = data?.agency?.name ?? "Studio";
  const formTitle = data?.form?.title ?? "Client Intake Form";

  return {
    title: `${agencyName} sent you a form`,
    description: formTitle,
    openGraph: {
      title: `${agencyName} sent you a form`,
      description: formTitle,
      // Empty images array suppresses the default Cineflow OG image
      images: [],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${agencyName} sent you a form`,
      description: formTitle,
    },
  };
}

export default async function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FormClient token={token} />;
}
