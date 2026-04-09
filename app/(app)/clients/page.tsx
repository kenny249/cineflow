"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Folder, ChevronDown, ChevronRight, Users, Briefcase } from "lucide-react";
import { MOCK_PROJECTS } from "@/mock/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, PROJECT_TYPE_LABELS } from "@/lib/utils";
import type { Project } from "@/types";

const GROUP_BY_CLIENT = (projects: Project[]) => {
  const groups = new Map<string, Project[]>();
  projects.forEach((project) => {
    const key = project.client_name?.trim() || "Unassigned";
    const existing = groups.get(key) ?? [];
    existing.push(project);
    groups.set(key, existing);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
};

export default function ClientsPage() {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [newClientName, setNewClientName] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const groups = useMemo(() => GROUP_BY_CLIENT(projects), [projects]);

  const addClientProject = () => {
    if (!newClientName.trim() || !newProjectTitle.trim()) return;
    const newProject: Project = {
      id: `proj_${Math.random().toString(36).slice(2)}`,
      title: newProjectTitle.trim(),
      client_name: newClientName.trim(),
      status: "draft",
      type: "other",
      progress: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      description: `Project started for ${newClientName.trim()}`,
      thumbnail_url: `https://source.unsplash.com/900x500/?cinematic,${encodeURIComponent(newProjectTitle.trim())}`,
    } as Project;
    setProjects((prev) => [newProject, ...prev]);
    setNewClientName("");
    setNewProjectTitle("");
    setShowCreate(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Clients</h1>
          <p className="text-xs text-muted-foreground">Organize projects by client, folder-style.</p>
        </div>
        <Button
          variant="gold"
          size="sm"
          onClick={() => setShowCreate((value) => !value)}
          className="h-9 gap-2"
        >
          <Plus className="h-4 w-4" />
          New Client Project
        </Button>
      </div>

      {showCreate && (
        <div className="border-b border-border bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-name">Client name</Label>
                <Input
                  id="client-name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Volta EV"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-title">Project title</Label>
                <Input
                  id="project-title"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="e.g. Launch campaign"
                />
              </div>
            </div>
            <div className="flex items-end justify-end">
              <Button variant="gold" size="sm" onClick={addClientProject}>
                Add Client Project
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
        <div className="grid gap-4">
          {groups.map(([clientName, clientProjects]) => (
            <div key={clientName} className="rounded-3xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
                onClick={() =>
                  setExpandedClients((prev) => ({
                    ...prev,
                    [clientName]: !prev[clientName],
                  }))
                }
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d4a853]/10 text-[#d4a853]">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{clientName}</div>
                    <div className="text-xs text-muted-foreground">{clientProjects.length} project{clientProjects.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <span className="text-muted-foreground">
                  {expandedClients[clientName] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
              </button>

              {expandedClients[clientName] && (
                <div className="space-y-3 border-t border-border p-4">
                  {clientProjects.map((project) => (
                    <div key={project.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <Link href={`/projects/${project.id}`} className="font-semibold text-foreground hover:text-[#d4a853] transition-colors line-clamp-1">
                            {project.title}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {project.description ?? "No description yet."}
                          </p>
                        </div>
                        <Badge>{project.status === "active" ? "In production" : project.status}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{formatDate(project.created_at, "MMM d")}</span>
                        <span>•</span>
                        <span>{PROJECT_TYPE_LABELS[project.type]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
