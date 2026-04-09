"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Calendar, MoreHorizontal, Camera, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, PROJECT_TYPE_LABELS, getProgressColor } from "@/lib/utils";
import { getCinematicImageUrl, CINEMATIC_COUNT } from "@/lib/cinematic-images";
import { PhotoCropModal } from "./PhotoCropModal";
import type { Project } from "@/types";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [thumbVariant, setThumbVariant] = useState(0);
  const [thumbOverride, setThumbOverride] = useState<string | null>(null);
  const [thumbPos, setThumbPos] = useState({ x: 50, y: 50, scale: 1 });

  const storageKey = `cf_thumb_${project.id}`;
  const thumbPosKey = `cf_thumb_pos_${project.id}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      if (stored.startsWith("__variant:")) {
        setThumbVariant(parseInt(stored.replace("__variant:", ""), 10));
      } else {
        setThumbOverride(stored);
      }
    }
    const storedPos = localStorage.getItem(thumbPosKey);
    if (storedPos) {
      try { setThumbPos(JSON.parse(storedPos)); } catch {}
    }
  }, [storageKey, thumbPosKey]);

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
    const resetPos = { x: 50, y: 50, scale: 1 };
    setThumbPos(resetPos);
    localStorage.setItem(storageKey, `__variant:${next}`);
    localStorage.setItem(thumbPosKey, JSON.stringify(resetPos));
    toast.success("Generated new cinematic image");
  };

  const handleCropApply = (url: string, pos: { x: number; y: number; scale: number }) => {
    setThumbOverride(url);
    setThumbPos(pos);
    localStorage.setItem(storageKey, url);
    localStorage.setItem(thumbPosKey, JSON.stringify(pos));
    toast.success("Cover photo updated");
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
    <>
      <PhotoCropModal
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        onApply={handleCropApply}
        initialUrl={activeThumbnail}
      />

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
              style={{
                objectPosition: `${thumbPos.x}% ${thumbPos.y}%`,
                transform: `scale(${thumbPos.scale})`,
                transformOrigin: `${thumbPos.x}% ${thumbPos.y}%`,
              }}
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

            {/* Hover action buttons */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRegenerate(e);
                }}
                className="flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm hover:bg-black/80"
                title="Generate new cinematic image"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCropOpen(true);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm hover:bg-black/80"
              >
                <Camera className="h-3 w-3" />
                Edit photo
              </button>
            </div>
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
                        setCropOpen(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Edit cover</span>
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
    </>

  );
}
