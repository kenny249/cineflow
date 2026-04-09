"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  Plus,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  MessageSquare,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MOCK_PROJECTS } from "@/mock/projects";
import { formatDate } from "@/lib/utils";
import { saveVideoBlob, deleteVideoBlob, cacheUrl, getOrFetchUrl } from "@/lib/revision-store";

/** Serialisable metadata that lives in localStorage */
interface VideoMeta {
  id: string;
  name: string;
  size: number;
  duration: number;
  uploadedAt: string;
  project_id: string;
}

/** Runtime shape — extends meta with a freshly-generated blob URL each session */
interface VideoFile extends VideoMeta {
  url: string;
}

interface TimestampNote {
  id: string;
  text: string;
  timestamp: number;
  author: string;
  createdAt: string;
}

/** Metadata in localStorage (no File object, no blob URL — both survive serialisation) */
const META_KEY  = "cineflow-revision-meta";
const NOTES_KEY = "cineflow-revision-notes";

export default function RevisionsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState(MOCK_PROJECTS[0]?.id ?? "");
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState<Record<string, TimestampNote[]>>({});
  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  /* ── Load: restore metadata from localStorage, re-hydrate blobs from IndexedDB ── */
  useEffect(() => {
    let alive = true;

    (async () => {
      const rawNotes = localStorage.getItem(NOTES_KEY);
      if (rawNotes) {
        try { setNotes(JSON.parse(rawNotes)); } catch { /* ignore */ }
      }

      const rawMeta = localStorage.getItem(META_KEY);
      if (!rawMeta) return;

      let metas: VideoMeta[];
      try { metas = JSON.parse(rawMeta); } catch { return; }

      const loaded: VideoFile[] = [];
      for (const meta of metas) {
        if (!alive) return;
        const url = await getOrFetchUrl(meta.id);
        if (url) loaded.push({ ...meta, url });
      }

      if (!alive) return;
      if (loaded.length > 0) {
        setVideos(loaded);
        setSelectedVideoId(loaded[0].id);
      }
    })();

    // No URL revocation — session cache keeps URLs alive across remounts.
    return () => { alive = false; };
  }, []);

  /* ── Persist: save serialisable metadata whenever videos list changes ── */
  useEffect(() => {
    const metas: VideoMeta[] = videos.map(({ url: _url, ...meta }) => meta);
    localStorage.setItem(META_KEY, JSON.stringify(metas));
  }, [videos]);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? videos[0] ?? null,
    [videos, selectedVideoId]
  );

  useEffect(() => {
    if (!selectedVideo && videos.length > 0) {
      setSelectedVideoId(videos[0].id);
    }
  }, [videos, selectedVideo]);

  const filteredVideoCount = useMemo(
    () => videos.filter((video) => video.project_id === selectedProjectId).length,
    [videos, selectedProjectId]
  );

  const handleVideoUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file");
      return;
    }

    if (file.size > 2 * 1024 * 1024 * 1024) {
      toast.error("File size must be less than 2GB");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const simulateProgress = setInterval(() => {
      setUploadProgress((prev) => {
        const next = Math.min(prev + Math.random() * 25, 90);
        if (next >= 90) clearInterval(simulateProgress);
        return next;
      });
    }, 300);

    try {
      // Create a temporary blob URL just to read duration metadata
      const tempUrl = URL.createObjectURL(file);
      const meta = await new Promise<VideoMeta>((resolve, reject) => {
        const v = document.createElement("video");
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(tempUrl);
          resolve({
            id: Math.random().toString(36).slice(2),
            name: file.name,
            size: file.size,
            duration: v.duration,
            uploadedAt: new Date().toISOString(),
            project_id: selectedProjectId,
          });
        };
        v.onerror = () => { URL.revokeObjectURL(tempUrl); reject(new Error("metadata")); };
        v.src = tempUrl;
      });

      // Persist blob to IndexedDB so it survives navigation
      await saveVideoBlob(meta.id, file);

      // Create the session URL and register it in the session cache
      const url = URL.createObjectURL(file);
      cacheUrl(meta.id, url);

      const newVideo: VideoFile = { ...meta, url };
      setVideos((prev) => [newVideo, ...prev]);
      setSelectedVideoId(newVideo.id);
      setNotes((prev) => ({ ...prev, [newVideo.id]: [] }));

      clearInterval(simulateProgress);
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        toast.success("Revision uploaded — it will persist across navigation");
      }, 300);
    } catch {
      clearInterval(simulateProgress);
      toast.error("Failed to upload video");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;

    URL.revokeObjectURL(video.url);
    await deleteVideoBlob(videoId).catch(() => {});

    setVideos((prev) => prev.filter((v) => v.id !== videoId));
    setNotes((prev) => {
      const next = { ...prev };
      delete next[videoId];
      return next;
    });

    if (selectedVideoId === videoId) {
      const remaining = videos.filter((v) => v.id !== videoId);
      setSelectedVideoId(remaining[0]?.id ?? null);
    }

    toast.success("Revision removed");
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !selectedVideo || !videoRef.current) return;

    const newNote: TimestampNote = {
      id: Math.random().toString(36).slice(2),
      text: noteText.trim(),
      timestamp: videoRef.current.currentTime,
      author: "You",
      createdAt: new Date().toISOString(),
    };

    setNotes((prev) => ({
      ...prev,
      [selectedVideo.id]: [...(prev[selectedVideo.id] || []), newNote].sort((a, b) => a.timestamp - b.timestamp),
    }));

    setNoteText("");
    setShowNoteForm(false);
    toast.success("Timestamp note created");
  };

  const handleDeleteNote = (noteId: string) => {
    if (!selectedVideo) return;
    setNotes((prev) => ({
      ...prev,
      [selectedVideo.id]: prev[selectedVideo.id]?.filter((note) => note.id !== noteId) ?? [],
    }));
  };

  const handleNoteClick = (timestamp: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = timestamp;
    setCurrentTime(timestamp);
    videoRef.current.play();
    setIsPlaying(true);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      : `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const noteCount = selectedVideo ? notes[selectedVideo.id]?.length ?? 0 : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Revisions</h1>
            <p className="text-xs text-muted-foreground">Keep each revision tied to a project, and return to work without losing your uploads.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-border bg-card px-3 py-2 text-xs text-foreground">
              {filteredVideoCount} revision{filteredVideoCount === 1 ? "" : "s"} for this project
            </div>
            <label className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-[#0a0a0a] transition-all hover:bg-[#e0b866] cursor-pointer">
              <Plus className="h-4 w-4" />
              Upload revision
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-72 border-r border-border bg-card/70 p-5 sm:block">
          <div className="space-y-5">
            <div className="rounded-3xl border border-border bg-muted p-4">
              <h2 className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Projects</h2>
              <div className="mt-4 space-y-2">
                {MOCK_PROJECTS.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                      project.id === selectedProjectId
                        ? "border-[#d4a853] bg-[#d4a853]/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-[#d4a853]/30 hover:bg-[#d4a853]/[0.05]"
                    }`}
                  >
                    <span className="text-sm font-medium truncate">{project.title}</span>
                    <span className="text-[10px] text-muted-foreground">{project.status}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UploadCloud className="h-4 w-4 text-[#d4a853]" />
                Revision library
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Videos are stored in browser storage and persist across navigation and page reloads.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedVideo ? (
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 bg-black/40 flex items-center justify-center overflow-hidden relative">
                  <video
                    ref={videoRef}
                    src={selectedVideo.url}
                    className="max-w-full max-h-full"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  />

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={(e) => {
                          const newTime = parseFloat(e.target.value);
                          setCurrentTime(newTime);
                          if (videoRef.current) videoRef.current.currentTime = newTime;
                        }}
                        className="flex-1 h-1 bg-white/30 rounded cursor-pointer"
                      />
                      <span className="text-xs text-white/70">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              if (isPlaying) videoRef.current.pause();
                              else videoRef.current.play();
                            }
                          }}
                          className="p-2 hover:bg-white/15 rounded-lg transition-all duration-150 active:scale-90"
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4 text-white" />
                          ) : (
                            <Play className="h-4 w-4 text-white" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setIsMuted((prev) => !prev);
                            if (videoRef.current) videoRef.current.muted = !isMuted;
                          }}
                          className="p-1 hover:bg-white/15 rounded-lg transition-all duration-150 active:scale-90"
                        >
                          {isMuted ? (
                            <VolumeX className="h-4 w-4 text-white" />
                          ) : (
                            <Volume2 className="h-4 w-4 text-white" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={(e) => {
                            const newVolume = parseFloat(e.target.value);
                            setVolume(newVolume);
                            if (videoRef.current) videoRef.current.volume = newVolume;
                          }}
                          className="w-20 h-1 bg-white/30 rounded cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const anchor = document.createElement("a");
                            anchor.href = selectedVideo.url;
                            anchor.download = selectedVideo.name;
                            anchor.click();
                            toast.success("Download started");
                          }}
                          className="p-2 hover:bg-white/15 rounded-lg transition-all duration-150 active:scale-90"
                          title="Download"
                        >
                          <Download className="h-4 w-4 text-white" />
                        </button>
                        <button
                          onClick={() => videoRef.current?.requestFullscreen()}
                          className="p-2 hover:bg-white/15 rounded-lg transition-all duration-150 active:scale-90"
                          title="Fullscreen"
                        >
                          <Maximize className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Frame Notes ({noteCount})
                    </h3>
                    <button
                      onClick={() => setShowNoteForm(true)}
                      className="rounded-md bg-[#d4a853]/20 px-3 py-1 text-xs font-semibold text-[#0a0a0a] hover:bg-[#e0b866] transition"
                    >
                      Add note
                    </button>
                  </div>

                  {showNoteForm && (
                    <div className="mb-4 flex gap-2">
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Write a timecode note..."
                        className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddNote();
                          if (e.key === "Escape") setShowNoteForm(false);
                        }}
                      />
                      <button
                        onClick={handleAddNote}
                        className="rounded-md bg-[#d4a853] px-4 py-2 text-sm font-semibold text-[#0a0a0a] hover:bg-[#e0b866]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowNoteForm(false)}
                        className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {(notes[selectedVideo.id] || []).map((note) => (
                      <div
                        key={note.id}
                        className="group relative w-full rounded-2xl border border-border bg-muted p-3 text-left transition hover:border-[#d4a853]/30 hover:bg-[#d4a853]/[0.05]"
                      >
                        <button
                          type="button"
                          onClick={() => handleNoteClick(note.timestamp)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground pr-6">
                            <span>{formatTime(note.timestamp)}</span>
                            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="mt-2 text-sm text-foreground">{note.text}</p>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                          className="absolute right-2 top-2 rounded p-1 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
                          title="Delete note"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hidden md:block w-64 border-l border-border bg-card/50 p-4">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Revision library</h2>
                    <p className="mt-2 text-xs text-muted-foreground">Select a revision to continue editing, or upload a new one to attach to this project.</p>
                  </div>
                  <div className="space-y-3">
                    {videos
                      .filter((video) => video.project_id === selectedProjectId)
                      .map((video) => (
                        <div
                          key={video.id}
                          className={`group relative w-full rounded-2xl border px-4 py-3 text-left transition ${
                            selectedVideo?.id === video.id
                              ? "border-[#d4a853] bg-[#d4a853]/10"
                              : "border-border bg-card hover:border-[#d4a853]/30 hover:bg-[#d4a853]/[0.05]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedVideoId(video.id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-foreground truncate pr-6">{video.name}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(video.uploadedAt, "MMM d")}</span>
                            </div>
                            <p className="mt-2 text-[11px] text-muted-foreground">{formatFileSize(video.size)}</p>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteVideo(video.id); }}
                            className="absolute right-2 top-2 rounded p-1 opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
                            title="Remove revision"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
              Select a revision on the right or upload one to start reviewing footage.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

