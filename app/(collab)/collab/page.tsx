"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Film, FolderOpen, LogOut } from "lucide-react";
import type { ProjectCollaborator } from "@/types";

interface CollabProject {
  id: string;
  title: string;
  client_name?: string;
  status: string;
  thumbnail_url?: string;
}

export default function CollabHomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<CollabProject[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, is_collaborator")
        .eq("id", user.id)
        .single();

      // Agency users who land here accidentally go to dashboard
      if (profile && !profile.is_collaborator) {
        router.replace("/dashboard");
        return;
      }

      if (profile?.first_name || profile?.last_name) {
        setDisplayName([profile.first_name, profile.last_name].filter(Boolean).join(" "));
      }

      // Fetch all projects this collaborator is active on
      const { data: collabs } = await supabase
        .from("project_collaborators")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("status", "active");

      const projectIds = (collabs as Pick<ProjectCollaborator, "project_id">[] ?? []).map((c) => c.project_id);
      if (projectIds.length === 0) { setLoading(false); return; }

      const { data: projectData } = await supabase
        .from("projects")
        .select("id, title, client_name, status, thumbnail_url")
        .in("id", projectIds);

      setProjects(projectData ?? []);
      setLoading(false);
    }

    load();
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0b]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d4a853] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="pointer-events-none fixed left-0 top-0 h-64 w-full bg-[radial-gradient(ellipse_60%_40%_at_30%_0%,rgba(212,168,83,0.06),transparent)]" />

      {/* Header */}
      <header className="border-b border-white/[0.06] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/12">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xs font-semibold tracking-tight text-white/80">Cineflow</span>
              <span className="text-[9px] text-white/20 tracking-widest uppercase">Project Workspace</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {displayName && <span className="text-xs text-white/40">{displayName}</span>}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/40 hover:text-white hover:border-white/20 transition-colors"
            >
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">
            {displayName ? `Hey, ${displayName.split(" ")[0]}` : "Your Projects"}
          </h1>
          <p className="text-sm text-white/40 mt-1">Projects you've been invited to collaborate on.</p>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-white/10 mb-3" />
            <p className="text-sm text-white/30">No projects yet — your invite may still be pending.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/collab/${project.id}`)}
                className="group text-left rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-[#d4a853]/20 hover:bg-[#d4a853]/[0.03] transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-[#d4a853] transition-colors">
                      {project.title}
                    </p>
                    {project.client_name && (
                      <p className="text-xs text-white/40 mt-0.5 truncate">{project.client_name}</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${
                    project.status === "active"    ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" :
                    project.status === "review"    ? "text-amber-400 border-amber-400/20 bg-amber-400/10" :
                    project.status === "delivered" ? "text-blue-400 border-blue-400/20 bg-blue-400/10" :
                    "text-white/30 border-white/10 bg-white/5"
                  }`}>
                    {project.status}
                  </span>
                </div>
                <p className="mt-4 text-[11px] text-[#d4a853]/50 group-hover:text-[#d4a853]/70 transition-colors">
                  Open project →
                </p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
