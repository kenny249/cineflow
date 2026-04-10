"use client";

import { useEffect, useState, useRef } from "react";
import { ScrollText, ChevronRight, Plus, Save, Search, X, FileText, Film, Trash2, ArrowLeft } from "lucide-react";
import { getProjects } from "@/lib/supabase/queries";
import { toast } from "sonner";
import type { Project } from "@/types";

// ─── Script storage helpers ───────────────────────────────────────────────────

const SCRIPTS_KEY = "cineflow-scripts";

interface ScriptMeta {
  projectId: string;
  title: string;
  content: string;
  updatedAt: string;
}

function loadScripts(): ScriptMeta[] {
  try {
    const raw = localStorage.getItem(SCRIPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveScript(projectId: string, title: string, content: string) {
  const all = loadScripts().filter((s) => s.projectId !== projectId);
  all.push({ projectId, title, content, updatedAt: new Date().toISOString() });
  localStorage.setItem(SCRIPTS_KEY, JSON.stringify(all));
}

function deleteScript(projectId: string) {
  const all = loadScripts().filter((s) => s.projectId !== projectId);
  localStorage.setItem(SCRIPTS_KEY, JSON.stringify(all));
}

// ─── Scene detection ─────────────────────────────────────────────────────────

function parseScenes(content: string) {
  const lines = content.split("\n");
  const scenes: { line: number; heading: string }[] = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim().toUpperCase();
    if (
      trimmed.startsWith("INT.") ||
      trimmed.startsWith("EXT.") ||
      trimmed.startsWith("INT/EXT.") ||
      trimmed.startsWith("I/E.") ||
      /^SCENE \d+/.test(trimmed)
    ) {
      scenes.push({ line: i, heading: line.trim() });
    }
  });
  return scenes;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScriptsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scripts, setScripts] = useState<ScriptMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
    setScripts(loadScripts());
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedId);
  const currentScript = scripts.find((s) => s.projectId === selectedId);
  const scenes = parseScenes(content);

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  function selectProject(id: string) {
    // Auto-save current before switching
    if (dirty && selectedId) {
      const prev = projects.find((p) => p.id === selectedId);
      if (prev) {
        saveScript(selectedId, prev.title, content);
        setScripts(loadScripts());
      }
    }
    setSelectedId(id);
    const script = scripts.find((s) => s.projectId === id);
    setContent(script?.content ?? "");
    setDirty(false);
    setMobileView("editor");
  }

  function handleChange(val: string) {
    setContent(val);
    setDirty(true);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      if (selectedId && selectedProject) {
        saveScript(selectedId, selectedProject.title, val);
        setScripts(loadScripts());
        setDirty(false);
      }
    }, 1500);
  }

  function handleSave() {
    if (!selectedId || !selectedProject) return;
    saveScript(selectedId, selectedProject.title, content);
    setScripts(loadScripts());
    setDirty(false);
    toast.success("Script saved");
  }

  function handleDelete() {
    if (!selectedId) return;
    deleteScript(selectedId);
    setScripts(loadScripts());
    setContent("");
    setSelectedId(null);
    setDirty(false);
    setMobileView("list");
    toast.success("Script deleted");
  }

  function jumpToScene(lineNum: number) {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = content.split("\n").slice(0, lineNum);
    const pos = lines.join("\n").length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 22;
    ta.scrollTop = lineNum * lineHeight;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {mobileView === "editor" && (
            <button
              onClick={() => setMobileView("list")}
              className="mr-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <ScrollText className="h-4 w-4 text-[#d4a853]" />
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
            {mobileView === "editor" && selectedProject ? selectedProject.title : "Scripts"}
          </h1>
          {dirty && <span className="h-1.5 w-1.5 rounded-full bg-[#d4a853]" title="Unsaved changes" />}
        </div>
        {selectedId && mobileView === "editor" && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete script"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Project list ── */}
        <div className={`flex w-64 shrink-0 flex-col border-r border-border ${mobileView === "editor" ? "hidden md:flex" : "flex w-full md:w-64"}`}>
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find project…"
                className="w-full rounded-lg border border-border bg-muted/30 py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 custom-scrollbar">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <Film className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No projects yet</p>
              </div>
            )}
            {filtered.map((project) => {
              const hasScript = scripts.some((s) => s.projectId === project.id);
              const isSelected = selectedId === project.id;
              return (
                <button
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all group ${
                    isSelected
                      ? "bg-[#d4a853]/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    hasScript ? "bg-[#d4a853]/15 text-[#d4a853]" : "bg-muted/50 text-muted-foreground"
                  }`}>
                    {hasScript ? <FileText className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{project.title}</p>
                    {project.client_name && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{project.client_name}</p>
                    )}
                  </div>
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isSelected ? "rotate-90 text-[#d4a853]" : "opacity-0 group-hover:opacity-60"}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Editor area ── */}
        <div className={`flex flex-1 flex-col overflow-hidden ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
          {!selectedId ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center px-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border">
                <ScrollText className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Select a project</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Choose a project from the left to start writing or editing its script.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Script textarea */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5 hidden md:flex">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedProject?.title}</p>
                    {selectedProject?.client_name && (
                      <p className="text-xs text-muted-foreground">{selectedProject.client_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDelete}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete script"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {dirty ? "Save*" : "Save"}
                    </button>
                  </div>
                </div>

                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleChange(e.target.value)}
                  placeholder={`Write your script here...\n\nUse standard screenplay format:\n  INT. LOCATION - DAY\n  EXT. LOCATION - NIGHT\n\nScenes are auto-detected in the navigator.`}
                  className="flex-1 resize-none bg-transparent px-6 py-5 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none custom-scrollbar"
                  spellCheck
                  style={{ fontFamily: "'Courier New', Courier, monospace" }}
                />

                <div className="shrink-0 border-t border-border px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{content.split(/\s+/).filter(Boolean).length} words · {content.length} chars</span>
                  <span>{scenes.length} scene{scenes.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Scene navigator — desktop only */}
              {scenes.length > 0 && (
                <div className="hidden lg:flex w-56 shrink-0 flex-col border-l border-border bg-card/20">
                  <div className="px-3 py-2.5 border-b border-border">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Scene Navigator</p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
                    {scenes.map((scene, i) => (
                      <button
                        key={i}
                        onClick={() => jumpToScene(scene.line)}
                        className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                      >
                        <span className="mr-2 font-bold text-[#d4a853]/70">{i + 1}.</span>
                        <span className="truncate">{scene.heading}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
