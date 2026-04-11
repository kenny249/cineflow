import type { Metadata } from "next";
import ReviewPortalClient from "./ReviewPortalClient";

export const metadata: Metadata = {
  title: "Client Portal — CineFlow",
  description: "View your project progress and review cuts.",
};

export default async function ReviewPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ReviewPortalClient token={token} />;
}
