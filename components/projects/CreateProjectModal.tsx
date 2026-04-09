"use client";

import { useState } from "react";
import { X, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import { Project } from "@/types/index";
import { toast } from "sonner";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PROJECT_TYPES = [
  { value: "commercial", label: "Commercial" },
  { value: "documentary", label: "Documentary" },
  { value: "music_video", label: "Music Video" },
  { value: "short_film", label: "Short Film" },
  { value: "corporate", label: "Corporate" },
  { value: "wedding", label: "Wedding" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "In Production" },
  { value: "review", label: "In Review" },
  { value: "delivered", label: "Delivered" },
];

export function CreateProjectModal({ open, onClose, onSuccess }: CreateProjectModalProps) {
  const [form, setForm] = useState({
    title: "",
    client_name: "",
    status: "draft" as const,
    description: "",
    due_date: "",
    progress: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const getCoverUrl = (title: string) => {
    const query = encodeURIComponent(title.trim() || "cinematic shoot");
    return `https://source.unsplash.com/1600x900/?cinematic,${query}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.title.trim()) {
      toast.error("Project name is required");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to create a project");
        return;
      }

      const projectData: Omit<Project, "id" | "created_at" | "updated_at"> = {
        title: form.title.trim(),
        client_name: form.client_name || undefined,
        status: form.status as any,
        type: "commercial" as any,
        description: form.description || undefined,
        due_date: form.due_date ? form.due_date : undefined,
        progress: form.progress,
        created_by: user.id,
        tags: [],
        shoot_date: undefined,
        thumbnail_url: getCoverUrl(form.title),
      };

      await createProject(projectData);
      toast.success("Project created successfully");

      // Reset form
      setForm({
        title: "",
        client_name: "",
        status: "draft",
        description: "",
        due_date: "",
        progress: 0,
      });

      onClose();
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating project:", error);
      const message =
        error?.message?.toString() || "Failed to create project";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a853]/25 bg-[#d4a853]/10">
              <Film className="h-4 w-4 text-[#d4a853]" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                New Project
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Start a new production project
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">

          {/* Project name */}
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Project name <span className="text-[#d4a853]">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g. Volta Brand Manifesto"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              autoFocus
            />
          </div>

          {/* Client name */}
          <div className="space-y-1.5">
            <Label htmlFor="client">Client name</Label>
            <Input
              id="client"
              placeholder="e.g. Volta EV"
              value={form.client_name}
              onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
            />
          </div>

          {/* Type + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: any) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due-date">Due date</Label>
              <Input
                id="due-date"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="[color-scheme:dark]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gold"
              size="sm"
              disabled={!form.title.trim() || isLoading}
            >
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
