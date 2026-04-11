"use client";

import { useEffect, useState } from "react";
import { ScrollText, ChevronRight, Search, Film, FileText, PenLine } from "lucide-react";
import Link from "next/link";
import { getProjects } from "@/lib/supabase/queries";
import type { Project } from "@/types";

export default function ScriptsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-5 py-3.5">
        <ScrollText className="h-4 w-4 text-[#d4a853]" />
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Scripts</h1>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Explainer */}
        <div className="border-b border-border bg-[#d4a853]/[0.03] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d4a853]/10">
              <PenLine className="h-4 w-4 text-[#d4a853]" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Scripts live inside each project</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Write directly in the browser or upload a PDF or Final Draft file, all from the Scripts tab inside your project.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a project…"
              className="w-full rounded-lg border border-border bg-muted/30 py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-0.5 px-3 pb-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Film className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No projects found</p>
            </div>
          )}
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}?tab=scripts`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-muted/30 group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-[#d4a853]/10 group-hover:text-[#d4a853] transition-colors">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{project.title}</p>
                {project.client_name && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{project.client_name}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
