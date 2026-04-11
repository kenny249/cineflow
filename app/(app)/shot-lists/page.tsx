"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { CheckCircle2, Circle, ChevronRight, Film, Plus, Tag, Trash2, X } from "lucide-react";
import { getProjects, getShotLists, createShotList, deleteShotList, createShotListItem, updateShotListItem, deleteShotListItem } from "@/lib/supabase/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Project, ShotList, ShotListItem } from "@/types";
import { formatDate } from "@/lib/utils";

const DEFAULT_CATEGORIES = ["All", "Interior", "Exterior", "B-Roll", "Interview", "Action", "Dialogue", "VFX", "Other"];

const SHOT_TYPES = ["wide", "medium", "close_up", "extreme_close_up", "overhead", "drone", "pov", "other"] as const;

export default function ShotListsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [shotLists, setShotLists] = useState<ShotList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Create list dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [listCategory, setListCategory] = useState("Interior");
  const [customCategory, setCustomCategory] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("cf_shot_categories") || "[]"); } catch { return []; }
  });
  const [isCreating, setIsCreating] = useState(false);

  // Add shot dialog
  const [addShotOpen, setAddShotOpen] = useState(false);
  const [shotDesc, setShotDesc] = useState("");
  const [shotType, setShotType] = useState<ShotListItem["shot_type"]>("wide");
  const [shotScene, setShotScene] = useState("");
  const [shotNotes, setShotNotes] = useState("");
  const [isAddingShot, setIsAddingShot] = useState(false);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Load projects
  useEffect(() => {
    async function load() {
      try {
        const data = await getProjects();
        setProjects(data || []);
        if (data?.length) setProjectId(data[0].id);
      } catch {
        toast.error("Failed to load projects");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load shot lists when project changes
  useEffect(() => {
    if (!projectId) return;
    async function load() {
      setLoading(true);
      try {
        const data = await getShotLists(projectId);
        setShotLists(data || []);
        setSelectedListId(data?.[0]?.id ?? null);
      } catch {
        toast.error("Failed to load shot lists");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  const allCategories = useMemo(() => {
    const cats = [...DEFAULT_CATEGORIES.slice(1), ...customCategories];
    return ["All", ...Array.from(new Set(cats))];
  }, [customCategories]);

  const filteredLists = useMemo(() => {
    if (categoryFilter === "All") return shotLists;
    return shotLists.filter((l) => (l as any).category === categoryFilter);
  }, [shotLists, categoryFilter]);

  const selectedList = useMemo(() => shotLists.find((l) => l.id === selectedListId) ?? null, [shotLists, selectedListId]);

  const handleCreateList = useCallback(async () => {
    if (!listTitle.trim() || !projectId) return;
    setIsCreating(true);
    try {
      const cat = listCategory === "__custom__" ? customCategory.trim() : listCategory;
      const newList = await createShotList({
        project_id: projectId,
        title: listTitle.trim(),
        description: listDescription.trim() || undefined,
        category: cat,
      } as any);
      setShotLists((prev) => [newList, ...prev]);
      setSelectedListId(newList.id);
      setCreateOpen(false);
      setListTitle("");
      setListDescription("");
      setListCategory("Interior");
      setCustomCategory("");
      toast.success("Shot list created");
    } catch {
      toast.error("Failed to create shot list");
    } finally {
      setIsCreating(false);
    }
  }, [listTitle, listDescription, listCategory, customCategory, projectId]);

  const handleAddShot = useCallback(async () => {
    if (!shotDesc.trim() || !selectedListId) return;
    setIsAddingShot(true);
    try {
      const list = shotLists.find((l) => l.id === selectedListId);
      const nextNum = (list?.items?.length ?? 0) + 1;
      const newItem = await createShotListItem({
        shot_list_id: selectedListId,
        shot_number: nextNum,
        description: shotDesc.trim(),
        shot_type: shotType,
        camera_movement: "static",
        scene: shotScene.trim() || undefined,
        notes: shotNotes.trim() || undefined,
        is_complete: false,
      } as any);
      setShotLists((prev) =>
        prev.map((l) =>
          l.id === selectedListId ? { ...l, items: [...(l.items ?? []), newItem] } : l
        )
      );
      setAddShotOpen(false);
      setShotDesc("");
      setShotScene("");
      setShotNotes("");
      setShotType("wide");
      toast.success("Shot added");
    } catch {
      toast.error("Failed to add shot");
    } finally {
      setIsAddingShot(false);
    }
  }, [shotDesc, shotType, shotScene, shotNotes, selectedListId, shotLists]);

  const toggleComplete = useCallback(async (item: ShotListItem) => {
    const newVal = !item.is_complete;
    setShotLists((prev) =>
      prev.map((l) => ({
        ...l,
        items: l.items?.map((s) => (s.id === item.id ? { ...s, is_complete: newVal } : s)),
      }))
    );
    try {
      await updateShotListItem(item.id, { is_complete: newVal });
    } catch {
      setShotLists((prev) =>
        prev.map((l) => ({
          ...l,
          items: l.items?.map((s) => (s.id === item.id ? { ...s, is_complete: item.is_complete } : s)),
        }))
      );
      toast.error("Failed to update shot");
    }
  }, []);

  const handleDeleteList = useCallback(async (id: string) => {
    try {
      await deleteShotList(id);
      setShotLists((prev) => prev.filter((l) => l.id !== id));
      if (selectedListId === id) setSelectedListId(shotLists.find((l) => l.id !== id)?.id ?? null);
      toast.success("Shot list deleted");
    } catch {
      toast.error("Failed to delete shot list");
    }
  }, [selectedListId, shotLists]);

  const addCustomCategory = useCallback(() => {
    const cat = customCategory.trim();
    if (!cat || customCategories.includes(cat)) return;
    const updated = [...customCategories, cat];
    setCustomCategories(updated);
    localStorage.setItem("cf_shot_categories", JSON.stringify(updated));
    setListCategory(cat);
    setCustomCategory("");
  }, [customCategory, customCategories]);

  if (loading && !projects.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading shot lists…</p>
      </div>
    );
  }

  const completedCount = selectedList?.items?.filter((i) => i.is_complete).length ?? 0;
  const totalCount = selectedList?.items?.length ?? 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Shot Lists</h1>
          <p className="text-xs text-muted-foreground">Plan camera work for every project.</p>
        </div>
        <Button variant="gold" size="sm" className="h-9 gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Shot List
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — project + list selector */}
        <aside className="hidden w-72 flex-col border-r border-border bg-card/70 p-4 sm:flex overflow-y-auto custom-scrollbar">
          {/* Project selector */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    categoryFilter === cat
                      ? "bg-[#d4a853] text-black"
                      : "border border-border bg-card text-muted-foreground hover:border-[#d4a853]/40"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Shot lists for this project */}
          <div className="space-y-1.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Lists ({filteredLists.length})
            </p>
            {filteredLists.length === 0 ? (
              <p className="text-xs text-muted-foreground">No lists yet. Create one above.</p>
            ) : (
              filteredLists.map((list) => {
                const done = list.items?.filter((i) => i.is_complete).length ?? 0;
                const total = list.items?.length ?? 0;
                return (
                  <button
                    key={list.id}
                    onClick={() => setSelectedListId(list.id)}
                    className={`group flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-all ${
                      selectedListId === list.id
                        ? "border-[#d4a853] bg-[#d4a853]/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-[#d4a853]/30"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-medium ${selectedListId === list.id ? "text-foreground" : ""}`}>
                        {list.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {(list as any).category && <span className="mr-1.5 text-[#d4a853]/70">{(list as any).category}</span>}
                        {total > 0 ? `${done}/${total} done` : "No shots"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                        className="p-1 rounded text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Main content — selected shot list */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {!selectedList ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border">
                <Film className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="font-display font-semibold text-foreground">No shot list selected</p>
              <p className="text-sm text-muted-foreground">Create a shot list for the selected project to get started.</p>
              <Button variant="gold" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Shot List
              </Button>
            </div>
          ) : (
            <div className="p-6">
              {/* List header */}
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold text-foreground">{selectedList.title}</h2>
                    {(selectedList as any).category && (
                      <span className="flex items-center gap-1 rounded-full border border-[#d4a853]/30 bg-[#d4a853]/10 px-2 py-0.5 text-[10px] font-semibold text-[#d4a853]">
                        <Tag className="h-2.5 w-2.5" />
                        {(selectedList as any).category}
                      </span>
                    )}
                  </div>
                  {selectedList.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{selectedList.description}</p>
                  )}
                  {totalCount > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {completedCount}/{totalCount} shots complete
                      {completedCount === totalCount && totalCount > 0 && (
                        <span className="ml-1.5 text-emerald-400">✓ All done</span>
                      )}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="shrink-0 h-8 gap-1.5 text-xs" onClick={() => setAddShotOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Shot
                </Button>
              </div>

              {/* Progress bar */}
              {totalCount > 0 && (
                <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#d4a853] transition-all duration-500"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  />
                </div>
              )}

              {/* Shot rows */}
              {!selectedList.items?.length ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
                  <p className="text-sm text-muted-foreground">No shots yet.</p>
                  <button onClick={() => setAddShotOpen(true)} className="mt-2 text-sm text-[#d4a853] hover:underline">
                    Add the first shot
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  {/* Column header */}
                  <div className="grid grid-cols-[2.5rem_1fr_6rem_7rem_auto] items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
                    {["#", "Description", "Type", "Scene", ""].map((h) => (
                      <div key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {h}
                      </div>
                    ))}
                  </div>

                  {selectedList.items.map((item) => (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[2.5rem_1fr_6rem_7rem_auto] items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 ${
                        item.is_complete ? "bg-muted/20" : "bg-card hover:bg-accent/30"
                      }`}
                    >
                      {/* Complete toggle */}
                      <button
                        onClick={() => toggleComplete(item)}
                        className="flex items-center justify-center text-muted-foreground transition-colors hover:text-[#d4a853]"
                      >
                        {item.is_complete ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                        ) : (
                          <Circle className="h-4.5 w-4.5" />
                        )}
                      </button>

                      {/* Description */}
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${item.is_complete ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {item.description}
                        </p>
                        {item.notes && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.notes}</p>
                        )}
                      </div>

                      {/* Shot type */}
                      <span className="truncate text-xs text-muted-foreground capitalize">
                        {item.shot_type?.replace(/_/g, " ")}
                      </span>

                      {/* Scene */}
                      <span className="truncate text-xs text-muted-foreground">
                        {item.scene || "—"}
                      </span>

                      {/* Shot number */}
                      <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/50">
                        #{item.shot_number}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create Shot List Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Shot List</DialogTitle>
            <DialogDescription>Create a shot list for one of your projects.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder="Principal photography, day 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {allCategories.slice(1).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setListCategory(cat)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                      listCategory === cat
                        ? "bg-[#d4a853] text-black"
                        : "border border-border bg-card text-muted-foreground hover:border-[#d4a853]/40"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom category…"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomCategory()}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={addCustomCategory} type="button">Add</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={listDescription} onChange={(e) => setListDescription(e.target.value)} rows={2} placeholder="Optional notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleCreateList} disabled={isCreating || !listTitle.trim()}>
              {isCreating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Shot Dialog */}
      <Dialog open={addShotOpen} onOpenChange={setAddShotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Shot</DialogTitle>
            <DialogDescription>Add a new shot to "{selectedList?.title}".</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={shotDesc} onChange={(e) => setShotDesc(e.target.value)} rows={2} placeholder="Wide establishing shot of exterior…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Shot type</Label>
                <select
                  value={shotType}
                  onChange={(e) => setShotType(e.target.value as ShotListItem["shot_type"])}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                >
                  {SHOT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Scene</Label>
                <Input value={shotScene} onChange={(e) => setShotScene(e.target.value)} placeholder="e.g. SC-12A" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={shotNotes} onChange={(e) => setShotNotes(e.target.value)} placeholder="Golden hour, handheld…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddShotOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleAddShot} disabled={isAddingShot || !shotDesc.trim()}>
              {isAddingShot ? "Adding…" : "Add shot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
