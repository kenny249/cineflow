import { notFound } from "next/navigation";
import { SharedBriefClient } from "./SharedBriefClient";

export const dynamic = "force-dynamic";

export default async function SharedBriefPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const validToken = process.env.BRIEF_SHARE_TOKEN;
  if (!validToken || token !== validToken) {
    notFound();
  }

  return <SharedBriefClient token={token} />;
}
