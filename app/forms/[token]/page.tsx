import type { Metadata } from "next";
import FormClient from "./FormClient";

// Static metadata — no self-fetch (avoids circular edge-function issues).
// The opengraph-image.tsx file generates the og:image automatically.
export const metadata: Metadata = {
  title: "You've been sent a form",
  description: "Review and complete this intake questionnaire",
  openGraph: {
    title: "You've been sent a form",
    description: "Review and complete this intake questionnaire",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "You've been sent a form",
    description: "Review and complete this intake questionnaire",
  },
};

export default async function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FormClient token={token} />;
}
