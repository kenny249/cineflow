import { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import type { Project, ProjectMember, ProjectNote, Revision, ShotList, StoryboardFrame } from "@/types";
import { getProject, getProjectNotes, getShotLists } from "@/lib/supabase/queries";
import ProjectDetailTabs from "@/components/projects/ProjectDetailTabs";
import {
  MOCK_PROJECTS,
  MOCK_PROJECT_MEMBERS,
  MOCK_SHOT_LISTS,
  MOCK_STORYBOARD,
  MOCK_REVISIONS,
  MOCK_NOTES,
} from "@/mock/projects";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  const project = await getProject(id).catch(() => MOCK_PROJECTS.find((item) => item.id === id) ?? null);
  return { title: project?.title ?? "Project" };
}

export default async function SingleProjectPage({ params }: PageProps) {
  const { id } = await params;

  let project: Project | null = null;
  let notes: ProjectNote[] = [];
  let shotLists: ShotList[] = [];

  try {
    project = await getProject(id);
  } catch (error) {
    console.error("Error loading project:", error);
    project = MOCK_PROJECTS.find((item) => item.id === id) ?? null;
  }

  if (!project) {
    notFound();
  }

  try {
    notes = await getProjectNotes(id);
  } catch (error) {
    console.error("Project notes unavailable:", error);
    notes = [];
  }

  if (notes.length === 0) {
    notes = MOCK_NOTES[id] ?? [];
  }

  try {
    shotLists = await getShotLists(id);
  } catch (error) {
    console.error("Shot lists unavailable:", error);
    shotLists = [];
  }

  const shotList = shotLists[0] ?? MOCK_SHOT_LISTS[id] ?? null;
  const members: ProjectMember[] = MOCK_PROJECT_MEMBERS[id] ?? [];
  const revisions: Revision[] = MOCK_REVISIONS[id] ?? [];
  const storyboardFrames: StoryboardFrame[] = MOCK_STORYBOARD[id] ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <ProjectDetailTabs
        project={project}
        initialNotes={notes}
        initialShotList={shotList}
        initialStoryboardFrames={storyboardFrames}
        initialRevisions={revisions}
        initialMembers={members}
        userRole="owner"
      />
    </div>
  );
}
