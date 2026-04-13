import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ReviewPortalClient from "./ReviewPortalClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  try {
    const supabase = await createClient();

    // Look up token → project name (public RLS allows this without auth)
    const { data: tokenRow } = await supabase
      .from("review_tokens")
      .select("project_id, client_name")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (tokenRow?.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("title")
        .eq("id", tokenRow.project_id)
        .single();

      if (project?.title) {
        const clientGreeting = tokenRow.client_name
          ? `${tokenRow.client_name}, your`
          : "Your";

        return {
          title: `${project.title} – Client Portal | Cineflow`,
          description: `${clientGreeting} project is ready for review. View cuts, leave feedback, and track progress.`,
          openGraph: {
            title: `${project.title} – Client Review Portal`,
            description: `${clientGreeting} project is ready for review. View cuts, leave feedback, and track progress.`,
            siteName: "Cineflow",
          },
          twitter: {
            card: "summary",
            title: `${project.title} – Client Review Portal`,
            description: `${clientGreeting} project is ready for review.`,
          },
        };
      }
    }
  } catch {
    // Fall through to defaults
  }

  return {
    title: "Client Review Portal | Cineflow",
    description: "Your project is ready for review. View cuts, leave feedback, and track progress.",
    openGraph: {
      title: "Client Review Portal | Cineflow",
      description: "Your project is ready for review. View cuts, leave feedback, and track progress.",
      siteName: "Cineflow",
    },
    twitter: {
      card: "summary",
      title: "Client Review Portal | Cineflow",
      description: "Your project is ready for review.",
    },
  };
}

export default async function ReviewPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ReviewPortalClient token={token} />;
}
