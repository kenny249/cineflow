import type { Metadata } from "next";
import FormClient from "./FormClient";

const SITE_URL = "https://usecineflow.com";
const OG_IMAGE_URL = `${SITE_URL}/api/forms/og`;

// Hard-coded absolute og:image URL pointing to our Node.js API route.
// This bypasses the opengraph-image.tsx convention entirely — no edge
// runtime, no fallback to the root Cineflow OG image.
export const metadata: Metadata = {
  title: "You have been sent a form",
  description: "Review and complete your intake questionnaire",
  openGraph: {
    title: "You have been sent a form",
    description: "Review and complete your intake questionnaire",
    type: "website",
    images: [
      {
        url: OG_IMAGE_URL,
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
    images: [OG_IMAGE_URL],
  },
};

export default async function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FormClient token={token} />;
}
