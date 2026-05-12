import { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import type { Project, ProjectNote, ProjectRole, Revision, ShotList, StoryboardFrame } from "@/types";
import ProjectDetailTabs from "@/components/projects/ProjectDetailTabs";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: project?.title ?? "Project" };
}

export default async function SingleProjectPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Determine the real role of the logged-in user
  let userRole: ProjectRole = "owner";
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("workspace_id")
        .eq("id", user.id)
        .single();

      const isOwner = profile?.workspace_id === user.id;
      if (!isOwner) {
        const { data: member } = await supabase
          .from("team_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();

        if (member?.role === "admin") userRole = "admin";
        else userRole = "team";
      }
    }
  } catch { /* default to owner on error */ }

  let project: Project | null = null;
  let notes: ProjectNote[] = [];
  let shotLists: ShotList[] = [];
  let storyboardFrames: StoryboardFrame[] = [];
  let revisions: Revision[] = [];

  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    project = (data as Project | null) ?? null;
  } catch (error) {
    console.error("Error loading project:", error);
  }

  if (!project) {
    notFound();
  }

  try {
    const [notesRes, shotListsRes, storyboardRes, revisionsRes] = await Promise.all([
      supabase
        .from("project_notes")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("shot_lists")
        .select("*, shot_list_items (*)")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("storyboard_frames")
        .select("*")
        .eq("project_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("revisions")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
    ]);

    notes = (notesRes.data as ProjectNote[] | null) ?? [];
    shotLists = (shotListsRes.data as ShotList[] | null) ?? [];
    storyboardFrames = (storyboardRes.data as StoryboardFrame[] | null) ?? [];
    revisions = (revisionsRes.data as Revision[] | null) ?? [];
  } catch (error) {
    console.error("Error loading project data:", error);
  }

  const shotList = shotLists[0] ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <ProjectDetailTabs
        project={project}
        initialNotes={notes}
        initialShotList={shotList}
        initialStoryboardFrames={storyboardFrames}
        initialRevisions={revisions}
        initialMembers={[]}
        userRole={userRole}
      />
    </div>
  );
}
