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
import { formatDate, PROJECT_TYPE_LABELS, getProgressStyle } from "@/lib/utils";
import { getCinematicGradient, CINEMATIC_COUNT } from "@/lib/cinematic-images";
import { PhotoCropModal } from "./PhotoCropModal";
import { updateProject } from "@/lib/supabase/queries";
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
  const [imgError, setImgError] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const storageKey = `cf_thumb_${project.id}`;
  const thumbPosKey = `cf_thumb_pos_${project.id}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      // Clear stale Unsplash URLs that no longer resolve
      if (stored.includes("unsplash.com")) {
        localStorage.removeItem(storageKey);
      } else if (stored.startsWith("__variant:")) {
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
  // Only use real uploaded images — stale Unsplash/picsum URLs treated as absent
  const dbThumb =
    project.thumbnail_url &&
    !project.thumbnail_url.includes("unsplash.com") &&
    !project.thumbnail_url.includes("picsum.photos")
      ? project.thumbnail_url
      : null;
  // Real image URL to show — null means use gradient fallback
  const activeThumbnail: string | null = imgError ? null : (thumbOverride ?? dbThumb ?? null);
  // Gradient shown when no real image exists
  const gradientBg = getCinematicGradient(seed, thumbVariant);

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

  const handleCropApply = async (dataUrl: string, pos: { x: number; y: number; scale: number }) => {
    // Optimistic preview — show image immediately while upload runs
    const prevOverride = thumbOverride;
    const prevPos = thumbPos;
    setThumbOverride(dataUrl);
    setThumbPos(pos);
    setImgError(false);
    setCoverUploading(true);

    try {
      let publicUrl = dataUrl;

      if (dataUrl.startsWith("data:")) {
        // Convert data URL → Blob → upload to Supabase Storage
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const mimeMatch = dataUrl.match(/data:(.*?);base64,/);
        const mime = mimeMatch?.[1] ?? "image/jpeg";
        const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const base64 = dataUrl.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });

        const path = `${project.id}/cover/cover.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(path, blob, { upsert: true, contentType: mime });
        if (uploadError) throw uploadError;

        const { data: { publicUrl: url } } = supabase.storage
          .from("project-files")
          .getPublicUrl(path);
        publicUrl = url;
      }

      // Save real public URL to DB so project detail + list view pick it up
      await updateProject(project.id, { thumbnail_url: publicUrl });

      // Update state + localStorage with the stable public URL (not data URL)
      setThumbOverride(publicUrl);
      localStorage.setItem(storageKey, publicUrl);
      localStorage.setItem(thumbPosKey, JSON.stringify(pos));
      toast.success("Cover photo saved");
    } catch (err) {
      // Revert optimistic update on failure
      setThumbOverride(prevOverride);
      setThumbPos(prevPos);
      console.error("Cover upload failed:", err);
      toast.error("Couldn't save cover photo. Please try again.");
    } finally {
      setCoverUploading(false);
    }
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
        initialUrl={activeThumbnail ?? undefined}
      />

      <Link href={`/projects/${project.id}`} className="group block">
        <article className="relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-border/60 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
          {/* Thumbnail */}
          <div
            className="relative aspect-video w-full overflow-hidden"
            style={{ background: activeThumbnail ? undefined : gradientBg }}
          >
            {activeThumbnail && (
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
                onError={() => {
                  setImgError(true);
                  if (thumbOverride) {
                    localStorage.removeItem(storageKey);
                    setThumbOverride(null);
                  }
                }}
              />
            )}

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* Upload progress overlay */}
            {coverUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5">
                  <RefreshCw className="h-3 w-3 text-[#d4a853] animate-spin" />
                  <span className="text-[10px] text-white/80">Saving…</span>
                </div>
              </div>
            )}

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
                  className="shrink-0 opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
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
                indicatorStyle={getProgressStyle(project.progress)}
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
