"use client";

import { useMemo, useState } from "react";
import { List, Plus, Folder, Film, ChevronRight } from "lucide-react";
import { MOCK_PROJECTS, MOCK_SHOT_LISTS } from "@/mock/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Project, ShotList, ShotListItem } from "@/types";
import { formatDate, PROJECT_TYPE_LABELS } from "@/lib/utils";

export default function ShotListsPage() {
  const [projectId, setProjectId] = useState(MOCK_PROJECTS[0]?.id ?? "");
  const [shotLists, setShotLists] = useState<ShotList[]>(Object.values(MOCK_SHOT_LISTS));
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [firstShot, setFirstShot] = useState("");

  const selectedProject = useMemo(
    () => MOCK_PROJECTS.find((project) => project.id === projectId) ?? MOCK_PROJECTS[0],
    [projectId]
  );

  const projectsWithLists = useMemo(() => {
    return MOCK_PROJECTS.map((project) => ({
      project,
      lists: shotLists.filter((list) => list.project_id === project.id),
    }));
  }, [shotLists]);

  const handleCreateShotList = () => {
    if (!title.trim() || !projectId) return;

    const listId = `sl_${Math.random().toString(36).slice(2)}`;
    const items: ShotListItem[] = firstShot.trim()
      ? [
          {
            id: `sli_${Math.random().toString(36).slice(2)}`,
            shot_list_id: listId,
            shot_number: 1,
            description: firstShot.trim(),
            shot_type: "wide",
            camera_movement: "static",
            is_complete: false,
          },
        ]
      : [];

    const newList: ShotList = {
      id: listId,
      project_id: projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items,
    };

    setShotLists((prev) => [newList, ...prev]);
    setTitle("");
    setDescription("");
    setFirstShot("");
    setOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Shot Lists</h1>
          <p className="text-xs text-muted-foreground">Plan camera, scene, and location work for every project.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New Shot List
          </Button>
          <div className="rounded-2xl border border-border bg-card px-3 py-2 text-xs text-foreground">
            {shotLists.length} shot list{shotLists.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-72 border-r border-border bg-card/70 p-5 sm:block">
          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-muted p-4">
              <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                <Folder className="h-5 w-5 text-[#d4a853]" />
                Projects
              </div>
              <div className="mt-4 space-y-3">
                {MOCK_PROJECTS.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setProjectId(project.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                      project.id === projectId
                        ? "border-[#d4a853] bg-[#d4a853]/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-[#d4a853]/30 hover:bg-[#d4a853]/[0.05]"
                    }`}
                  >
                    <span>{project.title}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-4">
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Quick view</h3>
              <p className="mt-3 text-xs text-muted-foreground">
                Create shot lists by project and keep all team members aligned on camera coverage.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="grid gap-4">
            {projectsWithLists.map(({ project, lists }) => (
              <section key={project.id} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{project.client_name || "No client"}</div>
                    <p className="text-xs text-muted-foreground">{project.title}</p>
                  </div>
                  <Badge>{lists.length} list{lists.length === 1 ? "" : "s"}</Badge>
                </div>

                {lists.length === 0 ? (
                  <div className="mt-6 rounded-3xl border border-dashed border-border bg-muted/80 p-5 text-sm text-muted-foreground">
                    No shot lists created for this project yet. Start one with the button above.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {lists.map((list) => (
                      <div key={list.id} className="rounded-3xl border border-border bg-background p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-foreground">{list.title}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{list.description || "Shot list summary"}</p>
                          </div>
                          <Badge>{list.items?.length ?? 0} shots</Badge>
                        </div>
                        {list.items?.length ? (
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {list.items.slice(0, 2).map((item) => (
                              <div key={item.id} className="rounded-2xl border border-border bg-card p-3">
                                <div className="text-xs font-semibold text-foreground">#{item.shot_number} {item.scene || "Scene"}</div>
                                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Shot List</DialogTitle>
            <DialogDescription>Start a new shot list and attach it to one of your active projects.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="project">Project</Label>
              <select
                id="project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                {MOCK_PROJECTS.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">List title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Principal photography — day 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add context for camera coverage, key scenes, and mood."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="first-shot">First shot</Label>
              <Input
                id="first-shot"
                value={firstShot}
                onChange={(e) => setFirstShot(e.target.value)}
                placeholder="Enter the first shot description"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" size="sm" onClick={handleCreateShotList}>
              Create shot list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
