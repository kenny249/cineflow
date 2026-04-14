import type { Metadata } from "next";
import FormClient from "./FormClient";

const SITE_URL = "https://usecineflow.com";

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const ogImageUrl = `${SITE_URL}/api/forms/og?token=${token}`;

  return {
    title: "You have been sent a form",
    description: "Review and complete your intake questionnaire",
    openGraph: {
      title: "You have been sent a form",
      description: "Review and complete your intake questionnaire",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "You have been sent a form",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "You have been sent a form",
      description: "Review and complete your intake questionnaire",
      images: [ogImageUrl],
    },
  };
}

export default async function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FormClient token={token} />;
}
