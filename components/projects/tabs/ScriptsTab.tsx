"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollText, Upload, FileText, Save, Trash2, Files } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getProjectFiles, createProjectFile, deleteProjectFile } from "@/lib/supabase/queries";
import { FileUploadZone } from "./FileUploadZone";
import type { ProjectFile } from "@/types";
import { toast } from "sonner";

interface ScriptsTabProps {
  projectId: string;
  canEdit: boolean;
}

// ── Inline editor helpers (saves to Supabase as a .fountain text file) ────────

const SCRIPT_FILENAME = "script.fountain";

async function loadInlineScript(projectId: string): Promise<{ file: ProjectFile | null; content: string }> {
  const files = await getProjectFiles(projectId, "scripts");
  const scriptFile = files.find((f) => f.name === SCRIPT_FILENAME);
  if (!scriptFile?.public_url) return { file: scriptFile ?? null, content: "" };
  try {
    const res = await fetch(scriptFile.public_url, { cache: "no-store" });
    const text = await res.text();
    return { file: scriptFile, content: text };
  } catch {
    return { file: scriptFile, content: "" };
  }
}

async function saveInlineScript(
  projectId: string,
  content: string,
  existingFile: ProjectFile | null
): Promise<ProjectFile> {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  const blob = new Blob([content], { type: "text/plain" });
  const storagePath = `${projectId}/scripts/${SCRIPT_FILENAME}`;

  const { error } = await client.storage
    .from("project-files")
    .upload(storagePath, blob, { cacheControl: "1", upsert: true });
  if (error) throw error;

  const { data: urlData } = client.storage.from("project-files").getPublicUrl(storagePath);

  if (existingFile) {
    // Update existing record's public_url (storage path stays the same)
    return { ...existingFile, public_url: urlData?.publicUrl };
  }

  return createProjectFile({
    project_id: projectId,
    tab: "scripts",
    name: SCRIPT_FILENAME,
    storage_path: storagePath,
    public_url: urlData?.publicUrl,
    size: blob.size,
    mime_type: "text/plain",
    uploaded_by: user?.id,
  });
}

function parseScenes(content: string) {
  return content.split("\n").reduce<{ line: number; heading: string }[]>((acc, line, i) => {
    const t = line.trim().toUpperCase();
    if (t.startsWith("INT.") || t.startsWith("EXT.") || t.startsWith("INT/EXT.") || /^SCENE \d+/.test(t)) {
      acc.push({ line: i, heading: line.trim() });
    }
    return acc;
  }, []);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ScriptsTab({ projectId, canEdit }: ScriptsTabProps) {
  const [mode, setMode] = useState<"files" | "write">("files");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Write mode state
  const [content, setContent] = useState("");
  const [scriptFile, setScriptFile] = useState<ProjectFile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const allFiles = await getProjectFiles(projectId, "scripts");
        setFiles(allFiles);
        const inline = await loadInlineScript(projectId);
        setScriptFile(inline.file);
        if (inline.content) {
          setContent(inline.content);
          // Auto-switch to write mode if a script already exists
          setMode("write");
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // Non-inline uploaded files (exclude the managed script.fountain)
  const uploadedFiles = files.filter((f) => f.name !== SCRIPT_FILENAME);
  const scenes = parseScenes(content);

  function handleChange(val: string) {
    setContent(val);
    setDirty(true);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => triggerSave(val), 2000);
  }

  async function triggerSave(val: string) {
    if (!canEdit) return;
    try {
      const saved = await saveInlineScript(projectId, val, scriptFile);
      setScriptFile(saved);
      setDirty(false);
    } catch {
      // silent — will retry on explicit save
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await saveInlineScript(projectId, content, scriptFile);
      setScriptFile(saved);
      setDirty(false);
      toast.success("Script saved");
    } catch {
      toast.error("Failed to save script");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!scriptFile) return;
    try {
      const client = createClient();
      await client.storage.from("project-files").remove([scriptFile.storage_path]);
      await deleteProjectFile(scriptFile.id);
      setScriptFile(null);
      setContent("");
      setDirty(false);
      setMode("files");
      toast.success("Script deleted");
    } catch {
      toast.error("Failed to delete script");
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      toast.info("PDFs can't be edited as text — upload them via the Files mode instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target?.result as string;
      if (ext === "fdx") text = text.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
      handleChange(text);
      toast.success(`Imported "${file.name}"`);
    };
    reader.readAsText(file);
  }

  function jumpToScene(lineNum: number) {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = content.split("\n").slice(0, lineNum).join("\n").length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    ta.scrollTop = lineNum * (parseInt(getComputedStyle(ta).lineHeight) || 22);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Mode switcher ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
          <button
            onClick={() => setMode("write")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "write" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ScrollText className="h-3.5 w-3.5" />
            Write
            {dirty && <span className="h-1.5 w-1.5 rounded-full bg-[#d4a853]" />}
          </button>
          <button
            onClick={() => setMode("files")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "files" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Files className="h-3.5 w-3.5" />
            Files
            {uploadedFiles.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{uploadedFiles.length}</span>
            )}
          </button>
        </div>

        {/* Write mode controls */}
        {mode === "write" && canEdit && (
          <div className="flex items-center gap-1.5">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Upload className="h-3.5 w-3.5" />
              Import
              <input type="file" accept=".txt,.fountain,.fdx" className="hidden" onChange={handleImport} />
            </label>
            {scriptFile && (
              <button
                onClick={handleDelete}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete script"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* ── Write mode ── */}
      {mode === "write" && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden">
            {!content && canEdit && (
              <div className="shrink-0 border-b border-border bg-[#d4a853]/[0.04] px-5 py-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Start typing or import an existing script file.</p>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/5 px-3 py-1.5 text-xs font-medium text-[#d4a853] hover:bg-[#d4a853]/10 transition-colors shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  Import .txt / .fountain / .fdx
                  <input type="file" accept=".txt,.fountain,.fdx" className="hidden" onChange={handleImport} />
                </label>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              readOnly={!canEdit}
              placeholder={"Write your script here...\n\nUse standard screenplay format:\n  INT. LOCATION - DAY\n  EXT. LOCATION - NIGHT\n\nScenes are auto-detected in the navigator."}
              className="flex-1 resize-none bg-transparent px-6 py-5 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none custom-scrollbar"
              style={{ fontFamily: "'Courier New', Courier, monospace" }}
              spellCheck
            />
            <div className="shrink-0 border-t border-border px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{content.split(/\s+/).filter(Boolean).length} words</span>
              <span>{scenes.length} scene{scenes.length !== 1 ? "s" : ""} · auto-saved</span>
            </div>
          </div>

          {/* Scene navigator — desktop */}
          {scenes.length > 0 && (
            <div className="hidden lg:flex w-52 shrink-0 flex-col border-l border-border bg-card/20">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Scenes</p>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
                {scenes.map((scene, i) => (
                  <button
                    key={i}
                    onClick={() => jumpToScene(scene.line)}
                    className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                  >
                    <span className="mr-1.5 font-bold text-[#d4a853]/70">{i + 1}.</span>
                    <span className="truncate">{scene.heading}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Files mode ── */}
      {mode === "files" && (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-5 py-4">
          <p className="mb-4 text-xs text-muted-foreground">Upload PDFs, Final Draft (.fdx), Fountain, or any script format. Stored as-is.</p>
          {uploadedFiles.length === 0 && !canEdit ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground/20" />
              <p className="font-display font-semibold">No script files uploaded</p>
            </div>
          ) : (
            <FileUploadZone
              projectId={projectId}
              tab="scripts"
              files={uploadedFiles}
              onFilesChange={(updated) => setFiles([...updated, ...(scriptFile ? [scriptFile] : [])])}
              readOnly={!canEdit}
              accept=".pdf,.fdx,.fountain,.txt,.rtf,.docx,.doc"
              label="Upload script files (PDF, FDX, Fountain…)"
            />
          )}
        </div>
      )}
    </div>
  );
}
