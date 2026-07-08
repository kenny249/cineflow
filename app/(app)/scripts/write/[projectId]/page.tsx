import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScriptEditorPage } from "@/components/scripts/ScriptEditorPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();
  return { title: data?.title ? `Script — ${data.title}` : "Script Editor" };
}

export default async function ScriptWritePage({ params }: PageProps) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  let initialContent = "";
  let initialFileId: string | undefined;
  let initialStoragePath: string | undefined;
  let initialPublicUrl: string | undefined;

  try {
    const { data: scriptFile } = await supabase
      .from("project_files")
      .select("id, public_url, storage_path, size, created_at")
      .eq("project_id", projectId)
      .eq("tab", "scripts")
      .eq("name", "script.fountain")
      .maybeSingle();

    if (scriptFile?.public_url) {
      initialFileId = scriptFile.id;
      initialStoragePath = scriptFile.storage_path;
      initialPublicUrl = scriptFile.public_url;
      const res = await fetch(scriptFile.public_url, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) initialContent = await res.text();
    }
  } catch {
    // start blank — user can write from scratch
  }

  return (
    <ScriptEditorPage
      projectId={project.id}
      projectTitle={project.title}
      initialContent={initialContent}
      initialFileId={initialFileId}
      initialStoragePath={initialStoragePath}
      initialPublicUrl={initialPublicUrl}
    />
  );
}
