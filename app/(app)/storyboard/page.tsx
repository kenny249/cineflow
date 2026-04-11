"use client";

import { useMemo, useState } from "react";
import { Layers, Plus, Sparkles, ImageIcon, ArrowRight } from "lucide-react";
import { MOCK_PROJECTS, MOCK_STORYBOARD } from "@/mock/projects";
import { getCinematicImageUrl } from "@/lib/cinematic-images";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Project, StoryboardFrame } from "@/types";

const templateOptions = [
  {
    label: "Cinematic Hero",
    hint: "Moody car reveal with evening light and reflections.",
    title: "City street hero shot",
    description: "A slow dolly shot of the car moving through neon-lit city streets, focusing on reflections and motion.",
  },
  {
    label: "Luxury Portrait",
    hint: "Close-up elegance, natural light, and texture.",
    title: "Portrait-style brand moment",
    description: "A careful close-up of the product with soft camera movement and shallow depth of field.",
  },
  {
    label: "Action Sequence",
    hint: "Drone or tracking shot for fast-paced energy.",
    title: "Action sequence frame",
    description: "High-speed tracking shot with dynamic camera movement and bold visual contrast.",
  },
];

const buildCoverUrl = (projectTitle: string) =>
  getCinematicImageUrl(projectTitle, Math.floor(Math.random() * 12));

export default function StoryboardPage() {
  const projectOptions = useMemo(() => MOCK_PROJECTS, []);
  const [selectedProjectId, setSelectedProjectId] = useState(projectOptions[0]?.id ?? "");
  const [storyboardFrames, setStoryboardFrames] = useState<StoryboardFrame[]>(MOCK_STORYBOARD[selectedProjectId] ?? []);
  const [open, setOpen] = useState(false);
  const [frameTitle, setFrameTitle] = useState("");
  const [frameDescription, setFrameDescription] = useState("");
  const [frameDuration, setFrameDuration] = useState("");
  const [frameAngle, setFrameAngle] = useState("");
  const [template, setTemplate] = useState(templateOptions[0]);

  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.id === selectedProjectId) ?? projectOptions[0],
    [selectedProjectId, projectOptions]
  );

  const framesForProject = useMemo(
    () => storyboardFrames.filter((frame) => frame.project_id === selectedProjectId),
    [storyboardFrames, selectedProjectId]
  );

  const handleTemplateSelect = (option: typeof templateOptions[number]) => {
    setTemplate(option);
    setFrameTitle(option.title);
    setFrameDescription(option.description);
  };

  const handleAddFrame = () => {
    if (!selectedProjectId) return;
    if (!frameTitle.trim() || !frameDescription.trim()) return;

    const newFrame: StoryboardFrame = {
      id: `sb_${Math.random().toString(36).slice(2)}`,
      project_id: selectedProjectId,
      frame_number: framesForProject.length + 1,
      title: frameTitle.trim(),
      description: frameDescription.trim(),
      image_url: buildCoverUrl(selectedProject?.title ?? "storyboard"),
      shot_duration: frameDuration || "00:00:05",
      camera_angle: frameAngle || "Wide / Eye level",
      notes: "Auto-generated mood frame.",
      created_at: new Date().toISOString(),
    };

    setStoryboardFrames((prev) => [...prev, newFrame]);
    setOpen(false);
    setFrameTitle("");
    setFrameDescription("");
    setFrameDuration("");
    setFrameAngle("");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Storyboard</h1>
            <p className="text-xs text-muted-foreground">Build visual frames across all projects and keep ideas organized.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-border bg-card px-3 py-2 text-xs text-foreground">
              {framesForProject.length} frame{framesForProject.length === 1 ? "" : "s"} in "{selectedProject?.title || "Project"}"
            </div>
            <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Frame
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-72 border-r border-border bg-card/70 p-5 sm:block">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Project</h2>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-muted p-3">
                <div className="h-10 w-10 rounded-xl bg-[#d4a853]/10 flex items-center justify-center text-[#d4a853]">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{selectedProject?.title}</div>
                  <div className="text-xs text-muted-foreground">{selectedProject?.client_name || "No client assigned"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background p-4">
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">AI prompts</h3>
              <div className="mt-4 space-y-3">
                {templateOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => handleTemplateSelect(option)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                      template.label === option.label
                        ? "border-[#d4a853] bg-[#d4a853]/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-[#d4a853]/30 hover:bg-[#d4a853]/[0.05]"
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{option.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {framesForProject.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-card p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-muted text-[#d4a853]">
                <Layers className="h-6 w-6" />
              </div>
              <h2 className="font-display text-lg font-semibold text-foreground">No storyboard frames yet</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Add your first storyboard frame to build a visual roadmap for your shoot. Use the AI prompts to jumpstart a cinematic mood board.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {framesForProject.map((frame) => (
                <article key={frame.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg">
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    <img
                      src={frame.image_url}
                      alt={frame.title || `Storyboard frame ${frame.frame_number}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-white/70">Frame {frame.frame_number}</div>
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{frame.title}</h3>
                      {frame.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{frame.description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <span>{frame.shot_duration}</span>
                      <span>{frame.camera_angle}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Storyboard Frame</DialogTitle>
            <DialogDescription>
              Use AI prompts to generate a strong visual beat and attach it to your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="project">Project</Label>
              <select
                id="project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="storyboard-title">Frame title</Label>
              <Input
                id="storyboard-title"
                value={frameTitle}
                onChange={(e) => setFrameTitle(e.target.value)}
                placeholder="Enter a short frame name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="storyboard-description">Description</Label>
              <Textarea
                id="storyboard-description"
                value={frameDescription}
                onChange={(e) => setFrameDescription(e.target.value)}
                placeholder="Describe the shot mood, movement, and framing"
                rows={4}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="shot-duration">Duration</Label>
                <Input
                  id="shot-duration"
                  value={frameDuration}
                  onChange={(e) => setFrameDuration(e.target.value)}
                  placeholder="00:00:05"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camera-angle">Camera angle</Label>
                <Input
                  id="camera-angle"
                  value={frameAngle}
                  onChange={(e) => setFrameAngle(e.target.value)}
                  placeholder="Wide / Eye level"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" size="sm" onClick={handleAddFrame}>
              Add Frame
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
