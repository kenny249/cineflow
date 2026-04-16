"use client";

import { useEffect, useState, useMemo } from "react";
import { Film, ExternalLink, Search, Youtube, Globe, Mic, Link2, Filter, Clapperboard } from "lucide-react";

interface Project {
  id: string;
  title: string;
  type: string;
  status: string;
}

interface Deliverable {
  id: string;
  project_id: string;
  title: string;
  type: string;
  url: string;
  notes?: string;
  delivered_at?: string;
  created_at: string;
}

interface PortalData {
  client_name: string;
  projects: Project[];
  deliverables: Deliverable[];
}

const TYPE_LABELS: Record<string, string> = {
  short:     "Short / Reel",
  youtube:   "YouTube",
  web_video: "Web Video",
  podcast:   "Podcast",
  photo:     "Photo",
  other:     "Video",
};

const TYPE_COLORS: Record<string, string> = {
  short:     "bg-rose-500/10 text-rose-300 border-rose-500/20",
  youtube:   "bg-red-500/10 text-red-300 border-red-500/20",
  web_video: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  podcast:   "bg-purple-500/10 text-purple-300 border-purple-500/20",
  photo:     "bg-amber-500/10 text-amber-300 border-amber-500/20",
  other:     "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
};

function TypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? "h-3.5 w-3.5";
  switch (type) {
    case "youtube":   return <Youtube className={cls} />;
    case "web_video": return <Globe className={cls} />;
    case "podcast":   return <Mic className={cls} />;
    case "short":     return <Film className={cls} />;
    default:          return <Link2 className={cls} />;
  }
}

function getEmbedUrl(url: string): string | null {
  // Vimeo
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?title=0&byline=0&portrait=0`;
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return null;
}

function getPlatform(url: string): string {
  if (url.includes("vimeo.com")) return "Vimeo";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("drive.google.com")) return "Google Drive";
  if (url.includes("dropbox.com")) return "Dropbox";
  if (url.includes("frame.io")) return "Frame.io";
  try { return new URL(url).hostname.replace("www.", ""); } catch { return "Link"; }
}

function DeliverableCard({ item, project }: { item: Deliverable; project?: Project }) {
  const [expanded, setExpanded] = useState(false);
  const embedUrl = getEmbedUrl(item.url);
  const platform = getPlatform(item.url);
  const canEmbed = !!embedUrl;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:border-[#d4a853]/30 hover:bg-white/8">
      {/* Embed or placeholder */}
      {canEmbed && expanded ? (
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => canEmbed ? setExpanded(true) : window.open(item.url, "_blank")}
          className="group relative flex aspect-video w-full items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] hover:from-[#1f1c14] hover:to-[#0d0b07] transition-all cursor-pointer"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d4a853]/30 bg-[#d4a853]/10 transition-all group-hover:bg-[#d4a853]/20 group-hover:border-[#d4a853]/50">
              <TypeIcon type={item.type} className="h-6 w-6 text-[#d4a853]" />
            </div>
            <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">
              {canEmbed ? "Click to play" : `Open in ${platform}`}
            </span>
          </div>
          {/* Platform badge */}
          <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white/40 backdrop-blur-sm">
            {platform}
          </div>
        </button>
      )}

      {/* Info */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{item.title}</p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {project && (
                <span className="text-[11px] text-white/40">{project.title}</span>
              )}
              {item.delivered_at && (
                <span className="text-[11px] text-white/30">
                  {project && "·"} {new Date(item.delivered_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
            {item.notes && (
              <p className="mt-1 text-[11px] text-white/30 truncate">{item.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[item.type] ?? TYPE_COLORS.other}`}>
              <TypeIcon type={item.type} className="h-2.5 w-2.5" />
              {TYPE_LABELS[item.type] ?? item.type}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          {canEmbed && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#d4a853]/10 border border-[#d4a853]/20 py-2 text-xs font-semibold text-[#d4a853] hover:bg-[#d4a853]/20 transition-colors"
            >
              <Film className="h-3.5 w-3.5" />
              Play
            </button>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-xs font-medium text-white/50 hover:text-white/80 hover:border-white/20 transition-colors ${canEmbed && !expanded ? "px-3" : "flex-1 px-3"}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {canEmbed ? "Open" : "Open in " + platform}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ClientPortalPage({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    fetch(`/api/client/${token}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        const json = await res.json();
        setData(json);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const projectMap = useMemo(() => {
    if (!data) return new Map<string, Project>();
    return new Map(data.projects.map((p) => [p.id, p]));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.deliverables.filter((d) => {
      if (filterProject !== "all" && d.project_id !== filterProject) return false;
      if (filterType !== "all" && d.type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const proj = projectMap.get(d.project_id);
        if (
          !d.title.toLowerCase().includes(q) &&
          !proj?.title.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [data, filterProject, filterType, search, projectMap]);

  const allTypes = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.deliverables.map((d) => d.type))];
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808]">
        <div className="flex flex-col items-center gap-4">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
          <p className="text-sm text-white/30">Loading your content…</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808]">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <Clapperboard className="h-12 w-12 text-white/10" />
          <p className="text-lg font-semibold text-white/60">Portal not found</p>
          <p className="text-sm text-white/30 max-w-xs">This link may be invalid or has been deactivated. Contact your agency for a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <div className="border-b border-white/8 px-6 py-5">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4a853]/60">Cineflow</span>
              </div>
              <h1 className="font-display text-2xl font-bold text-white tracking-tight">
                {data.client_name}
              </h1>
              <p className="mt-0.5 text-sm text-white/40">
                {data.deliverables.length} {data.deliverables.length === 1 ? "deliverable" : "deliverables"} across {data.projects.length} {data.projects.length === 1 ? "project" : "projects"}
              </p>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/10">
              <Film className="h-5 w-5 text-[#d4a853]" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-white/8 px-6 py-3">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/25 focus:border-[#d4a853]/30 focus:outline-none"
            />
          </div>
          {/* Project filter */}
          {data.projects.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-white/30" />
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 py-2 pl-3 pr-8 text-sm text-white focus:border-[#d4a853]/30 focus:outline-none"
              >
                <option value="all">All projects</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}
          {/* Type filter */}
          {allTypes.length > 1 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 py-2 pl-3 pr-8 text-sm text-white focus:border-[#d4a853]/30 focus:outline-none"
            >
              <option value="all">All types</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="px-6 py-8">
        <div className="mx-auto max-w-5xl">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <Film className="h-12 w-12 text-white/10" />
              <p className="text-base font-semibold text-white/40">
                {data.deliverables.length === 0
                  ? "No deliverables yet"
                  : "No results match your filters"}
              </p>
              <p className="text-sm text-white/25 max-w-xs">
                {data.deliverables.length === 0
                  ? "Your agency will add final videos here when they're ready."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <DeliverableCard
                  key={item.id}
                  item={item}
                  project={projectMap.get(item.project_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/8 px-6 py-4 mt-4">
        <div className="mx-auto max-w-5xl flex items-center justify-center">
          <p className="text-[10px] text-white/20 tracking-widest uppercase">Powered by Cineflow</p>
        </div>
      </div>
    </div>
  );
}
