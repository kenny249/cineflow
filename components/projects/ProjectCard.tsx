"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Calendar, MoreHorizontal, Camera, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, PROJECT_TYPE_LABELS, getProgressColor } from "@/lib/utils";
import { getCinematicImageUrl, CINEMATIC_COUNT } from "@/lib/cinematic-images";
import type { Project } from "@/types";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [thumbVariant, setThumbVariant] = useState(0);
  const [thumbOverride, setThumbOverride] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const storageKey = `cf_thumb_${project.id}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      if (stored.startsWith("__variant:")) {
        setThumbVariant(parseInt(stored.replace("__variant:", ""), 10));
      } else {
        setThumbOverride(stored);
      }
    }
  }, [storageKey]);

  const seed = project.id || project.title;
  const activeThumbnail =
    thumbOverride ??
    project.thumbnail_url ??
    getCinematicImageUrl(seed, thumbVariant);

  const handleRegenerate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = (thumbVariant + 1) % CINEMATIC_COUNT;
    setThumbVariant(next);
    setThumbOverride(null);
    localStorage.setItem(storageKey, `__variant:${next}`);
    toast.success("Generated new cinematic image");
    setEditOpen(false);
  };

  const handleApplyUrl = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const val = urlInput.trim();
    if (!val) return;
    try {
      new URL(val);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }
    setThumbOverride(val);
    localStorage.setItem(storageKey, val);
    toast.success("Photo updated");
    setEditOpen(false);
    setUrlInput("");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/projects/${project.id}`);
      toast.success("Project link copied");
      setMenuOpen(false);
    } catch {
      toast.error("Unable to copy link.");
    }
  };

  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <article className="relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-border/60 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <Image
            src={activeThumbnail}
            alt={project.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
          />

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Type badge */}
          <div className="absolute left-3 top-3">
            <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm">
              {PROJECT_TYPE_LABELS[project.type]}
            </span>
          </div>

          {/* Status badge */}
          <div className="absolute right-3 top-3">
            <StatusBadge status={project.status} />
          </div>

          {/* Edit photo button — appears on hover */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEditOpen((v) => !v);
              setMenuOpen(false);
            }}
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/80"
          >
            <Camera className="h-3 w-3" />
            Edit photo
          </button>

          {/* Inline edit panel */}
          {editOpen && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm p-4"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditOpen(false); }}
                className="absolute right-2 top-2 rounded-md p-1 text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generate new
              </button>
              <div className="flex w-full gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Paste image URL…"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => { if (e.key === "Enter") handleApplyUrl(e as any); }}
                  className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="rounded-lg bg-[#d4a853] px-3 py-1.5 text-[10px] font-bold text-black hover:bg-[#d4a853]/90 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold text-foreground truncate group-hover:text-[#d4a853] transition-colors">
                {project.title}
              </h3>
              {project.client_name && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {project.client_name}
                </p>
              )}
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen((current) => !current);
                  setEditOpen(false);
                }}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-20 w-40 rounded-2xl border border-border bg-card p-2 shadow-lg">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/projects/${project.id}`);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <span>Open project</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyLink();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                  >
                    <span>Copy link</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Progress
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {project.progress}%
              </span>
            </div>
            <Progress
              value={project.progress}
              className="h-1"
              indicatorClassName={getProgressColor(project.progress)}
            />
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            {project.due_date ? (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Due {formatDate(project.due_date, "MMM d")}</span>
              </div>
            ) : (
              <div />
            )}
            {project.tags && project.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                  {project.tags[0]}
                </span>
                {project.tags.length > 1 && (
                  <span className="text-muted-foreground">+{project.tags.length - 1}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
