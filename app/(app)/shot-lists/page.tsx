"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { CheckCircle2, Circle, ChevronRight, Film, Image, Pencil, Plus, Tag, Trash2, Upload, X } from "lucide-react";
import { getProjects, getShotLists, createShotList, deleteShotList, createShotListItem, updateShotListItem, deleteShotListItem } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
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
  const supabase = createClient();
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

  // Add / Edit shot dialog
  const [shotDialogOpen, setShotDialogOpen] = useState(false);
  const [editingShot, setEditingShot] = useState<ShotListItem | null>(null);
  const [shotDesc, setShotDesc] = useState("");
  const [shotType, setShotType] = useState<ShotListItem["shot_type"]>("wide");
  const [shotScene, setShotScene] = useState("");
  const [shotNotes, setShotNotes] = useState("");
  const [shotImageFile, setShotImageFile] = useState<File | null>(null);
  const [shotImagePreview, setShotImagePreview] = useState<string | null>(null);
  const [isSavingShot, setIsSavingShot] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState("All");

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
      setListTitle(""); setListDescription(""); setListCategory("Interior"); setCustomCategory("");
      toast.success("Shot list created");
    } catch {
      toast.error("Failed to create shot list");
    } finally {
      setIsCreating(false);
    }
  }, [listTitle, listDescription, listCategory, customCategory, projectId]);

  function openAddShot() {
    setEditingShot(null);
    setShotDesc(""); setShotType("wide"); setShotScene(""); setShotNotes("");
    setShotImageFile(null); setShotImagePreview(null);
    setShotDialogOpen(true);
  }

  function openEditShot(item: ShotListItem) {
    setEditingShot(item);
    setShotDesc(item.description);
    setShotType(item.shot_type);
    setShotScene(item.scene || "");
    setShotNotes(item.notes || "");
    setShotImageFile(null);
    setShotImagePreview(item.image_url || null);
    setShotDialogOpen(true);
  }

  function handleImageChange(file: File | null) {
    setShotImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setShotImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setShotImagePreview(editingShot?.image_url || null);
    }
  }

  async function uploadShotImage(file: File): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("shot-images").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("shot-images").getPublicUrl(path);
    return publicUrl;
  }

  const handleSaveShot = useCallback(async () => {
    if (!shotDesc.trim() || !selectedListId) return;
    setIsSavingShot(true);
    try {
      let imageUrl = editingShot?.image_url || undefined;
      if (shotImageFile) {
        imageUrl = await uploadShotImage(shotImageFile);
      }

      if (editingShot) {
        const updated = await updateShotListItem(editingShot.id, {
          description: shotDesc.trim(),
          shot_type: shotType,
          scene: shotScene.trim() || undefined,
          notes: shotNotes.trim() || undefined,
          image_url: imageUrl,
        });
        setShotLists((prev) =>
          prev.map((l) => ({
            ...l,
            items: l.items?.map((s) => s.id === editingShot.id ? updated : s),
          }))
        );
        toast.success("Shot updated");
      } else {
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
          image_url: imageUrl,
          is_complete: false,
        } as any);
        setShotLists((prev) =>
          prev.map((l) =>
            l.id === selectedListId ? { ...l, items: [...(l.items ?? []), newItem] } : l
          )
        );
        toast.success("Shot added");
      }
      setShotDialogOpen(false);
    } catch {
      toast.error("Failed to save shot");
    } finally {
      setIsSavingShot(false);
    }
  }, [shotDesc, shotType, shotScene, shotNotes, shotImageFile, editingShot, selectedListId, shotLists]);

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

  const handleDeleteShot = useCallback(async (itemId: string) => {
    setShotLists((prev) =>
      prev.map((l) => ({ ...l, items: l.items?.filter((s) => s.id !== itemId) }))
    );
    try {
      await deleteShotListItem(itemId);
      toast.success("Shot deleted");
    } catch {
      toast.error("Failed to delete shot");
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
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h1 className="font-display text-lg font-bold text-foreground sm:text-xl">Shot Lists</h1>
          <p className="text-xs text-muted-foreground">Plan camera work for every project.</p>
        </div>
        <Button variant="gold" size="sm" className="h-9 gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Shot List</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* ── Mobile selectors (project + list) ── */}
      <div className="shrink-0 border-b border-border bg-card/50 px-4 py-3 sm:hidden space-y-2">
        <div className="relative">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted-foreground" />
        </div>
        {filteredLists.length > 0 && (
          <div className="relative">
            <select
              value={selectedListId ?? ""}
              onChange={(e) => setSelectedListId(e.target.value || null)}
              className="w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Select a shot list —</option>
              {filteredLists.map((l) => {
                const done = l.items?.filter((i) => i.is_complete).length ?? 0;
                const total = l.items?.length ?? 0;
                return <option key={l.id} value={l.id}>{l.title} ({done}/{total})</option>;
              })}
            </select>
            <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted-foreground" />
          </div>
        )}
        {filteredLists.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-1">No shot lists yet for this project.</p>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop only */}
        <aside className="hidden w-72 flex-col border-r border-border bg-card/70 p-4 sm:flex overflow-y-auto custom-scrollbar">
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Project</label>
            <div className="relative">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted-foreground" />
            </div>
          </div>

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
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                        className="p-1 rounded text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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

        {/* Main content */}
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
            <div className="p-4 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-foreground sm:text-lg">{selectedList.title}</h2>
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
                <Button variant="outline" size="sm" className="shrink-0 h-8 gap-1.5 text-xs" onClick={openAddShot}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Shot
                </Button>
              </div>

              {totalCount > 0 && (
                <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#d4a853] transition-all duration-500"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  />
                </div>
              )}

              {!selectedList.items?.length ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
                  <p className="text-sm text-muted-foreground">No shots yet.</p>
                  <button onClick={openAddShot} className="mt-2 text-sm text-[#d4a853] hover:underline">
                    Add the first shot
                  </button>
                </div>
              ) : (
                <>
                  {/* ── Desktop table ── */}
                  <div className="hidden sm:block overflow-hidden rounded-xl border border-border">
                    <div className="grid grid-cols-[2.5rem_auto_1fr_6rem_7rem_5rem] items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
                      {["#", "Inspo", "Description", "Type", "Scene", ""].map((h, i) => (
                        <div key={i} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</div>
                      ))}
                    </div>
                    {selectedList.items.map((item) => (
                      <div
                        key={item.id}
                        className={`grid grid-cols-[2.5rem_auto_1fr_6rem_7rem_5rem] items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 ${
                          item.is_complete ? "bg-muted/20" : "bg-card hover:bg-accent/30"
                        }`}
                      >
                        <button onClick={() => toggleComplete(item)} className="flex items-center justify-center text-muted-foreground transition-colors hover:text-[#d4a853]">
                          {item.is_complete ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4" />}
                        </button>
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40">
                          {item.image_url ? <img src={item.image_url} alt="inspo" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Image className="h-3.5 w-3.5 text-muted-foreground/30" /></div>}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${item.is_complete ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.description}</p>
                          {item.notes && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.notes}</p>}
                        </div>
                        <span className="truncate text-xs text-muted-foreground capitalize">{item.shot_type?.replace(/_/g, " ")}</span>
                        <span className="truncate text-xs text-muted-foreground">{item.scene || "—"}</span>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEditShot(item)} className="rounded p-1 text-muted-foreground/40 hover:bg-accent hover:text-foreground transition-colors" title="Edit shot"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteShot(item.id)} className="rounded p-1 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors" title="Delete shot"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Mobile cards ── */}
                  <div className="sm:hidden space-y-2">
                    {selectedList.items.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-xl border border-border overflow-hidden ${item.is_complete ? "bg-muted/20" : "bg-card"}`}
                      >
                        <div className="flex items-start gap-3 p-3">
                          {/* Complete toggle */}
                          <button onClick={() => toggleComplete(item)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-[#d4a853] transition-colors">
                            {item.is_complete ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5" />}
                          </button>

                          {/* Thumbnail */}
                          {item.image_url && (
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
                              <img src={item.image_url} alt="inspo" className="h-full w-full object-cover" />
                            </div>
                          )}

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium leading-snug ${item.is_complete ? "text-muted-foreground line-through" : "text-foreground"}`}>
                              {item.description}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {item.shot_type && (
                                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                                  {item.shot_type.replace(/_/g, " ")}
                                </span>
                              )}
                              {item.scene && (
                                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                                  Scene: {item.scene}
                                </span>
                              )}
                            </div>
                            {item.notes && <p className="mt-1 text-[11px] text-muted-foreground/70 leading-relaxed">{item.notes}</p>}
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 gap-1">
                            <button onClick={() => openEditShot(item)} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteShot(item.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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
              <div className="relative">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full appearance-none rounded-md border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted-foreground" />
              </div>
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

      {/* Add / Edit Shot Dialog */}
      <Dialog open={shotDialogOpen} onOpenChange={setShotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShot ? "Edit Shot" : "Add Shot"}</DialogTitle>
            <DialogDescription>
              {editingShot ? "Update this shot's details." : `Add a new shot to "${selectedList?.title}".`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={shotDesc} onChange={(e) => setShotDesc(e.target.value)} rows={2} placeholder="Wide establishing shot of exterior…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Shot type</Label>
                <div className="relative">
                  <select
                    value={shotType}
                    onChange={(e) => setShotType(e.target.value as ShotListItem["shot_type"])}
                    className="w-full appearance-none rounded-md border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {SHOT_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted-foreground" />
                </div>
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

            {/* Inspo photo upload */}
            <div className="space-y-1.5">
              <Label>Inspo Photo <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div
                onClick={() => imageFileRef.current?.click()}
                className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/50 px-4 py-3 transition-colors hover:border-[#d4a853]/40 hover:bg-[#d4a853]/[0.03]"
              >
                {shotImagePreview ? (
                  <>
                    <img src={shotImagePreview} alt="inspo preview" className="h-12 w-12 rounded-lg object-cover border border-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{shotImageFile?.name || "Current photo"}</p>
                      <p className="text-xs text-muted-foreground">Click to change</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShotImageFile(null); setShotImagePreview(null); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60">
                      <Upload className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Upload inspiration photo</p>
                      <p className="text-xs text-muted-foreground/60">JPG, PNG · Max 5MB</p>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={imageFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShotDialogOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleSaveShot} disabled={isSavingShot || !shotDesc.trim()}>
              {isSavingShot ? "Saving…" : editingShot ? "Save Changes" : "Add Shot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
