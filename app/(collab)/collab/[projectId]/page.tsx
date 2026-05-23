"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Film, LogOut, Send, ArrowLeft, Users, MessageSquare,
  List, CheckSquare, Info, MapPin, Phone, Clock,
  CheckCircle2, Circle, Camera, Mail, Globe, StickyNote, Plus,
  CalendarDays, FileText, Download, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ProjectMessage, ProjectCollaborator, ShotList,
  ProjectTask, CrewContact, ProjectLocation, ProjectNote,
} from "@/types";

interface CollabProject {
  id: string;
  title: string;
  client_name?: string;
  status: string;
  description?: string;
  shoot_date?: string;
}

type Tab = "chat" | "shots" | "tasks" | "notes" | "schedule" | "files" | "info";

interface CrewCallEntry {
  id: string;
  collaborator_id?: string | null;
  name: string;
  role?: string | null;
  call_time: string;
}

interface ShootDay {
  id: string;
  day_number: number;
  date?: string;
  general_call?: string;
  location?: string;
  notes?: string;
  crew_calls: CrewCallEntry[];
  created_at: string;
}

interface CollabFile {
  id: string;
  name: string;
  category?: string;
  public_url?: string;
  size?: number;
  mime_type?: string;
  created_at: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function statusStyle(status: string) {
  if (status === "active") return "text-emerald-400 border-emerald-400/20 bg-emerald-400/10";
  if (status === "review") return "text-amber-400 border-amber-400/20 bg-amber-400/10";
  if (status === "delivered") return "text-blue-400 border-blue-400/20 bg-blue-400/10";
  return "text-white/30 border-white/10 bg-white/5";
}

const SHOT_TYPE_LABELS: Record<string, string> = {
  wide: "Wide", medium: "Medium", close_up: "Close-Up",
  extreme_close_up: "ECU", overhead: "Overhead", drone: "Drone",
  pov: "POV", other: "Other",
};

const TASK_PRIORITY_COLOR: Record<string, string> = {
  high: "text-red-400 border-red-400/20 bg-red-400/10",
  medium: "text-amber-400 border-amber-400/20 bg-amber-400/10",
  low: "text-blue-400 border-blue-400/20 bg-blue-400/10",
};

const DEPT_ORDER = [
  "Production", "Direction", "Camera", "Lighting", "Grip", "Sound",
  "Art", "Wardrobe", "Hair & Makeup", "Talent", "Other",
];

export default function CollabProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<CollabProject | null>(null);
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);
  const [myPermissions, setMyPermissions] = useState<string[]>([]);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [shotLists, setShotLists] = useState<ShotList[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [crew, setCrew] = useState<CrewContact[]>([]);
  const [locations, setLocations] = useState<ProjectLocation[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [shootDays, setShootDays] = useState<ShootDay[]>([]);
  const [myCollaboratorId, setMyCollaboratorId] = useState<string>("");
  const [shotDayFilter, setShotDayFilter] = useState<string>("all");
  const [collabFiles, setCollabFiles] = useState<CollabFile[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [showPeople, setShowPeople] = useState(false);

  // Chat
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tasks
  const [togglingTask, setTogglingTask] = useState<string | null>(null);

  // Shots
  const [togglingShot, setTogglingShot] = useState<string | null>(null);
  const [pendingNoteForShot, setPendingNoteForShot] = useState<string | null>(null);
  const [shotNoteInput, setShotNoteInput] = useState("");
  const shotNoteRef = useRef<HTMLInputElement>(null);

  // Notes
  const [noteContent, setNoteContent] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, is_collaborator")
        .eq("id", user.id)
        .single();

      if (profile && !profile.is_collaborator) { router.replace("/dashboard"); return; }

      if (profile?.first_name || profile?.last_name) {
        setDisplayName([profile.first_name, profile.last_name].filter(Boolean).join(" "));
      }

      const { data: collab } = await supabase
        .from("project_collaborators")
        .select("id, permissions")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (!collab) { router.replace("/collab"); return; }
      setMyPermissions((collab.permissions as string[]) ?? []);

      const [projRes, collabsRes, msgsRes, shotRes, tasksRes, crewRes, locRes] = await Promise.all([
        supabase.from("projects").select("id, title, client_name, status, description, shoot_date").eq("id", projectId).single(),
        supabase.from("project_collaborators").select("*").eq("project_id", projectId).eq("status", "active"),
        supabase.from("project_messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true }).limit(100),
        supabase.from("shot_lists").select("*, shot_list_items(*)").eq("project_id", projectId).order("created_at", { ascending: true }),
        supabase.from("project_tasks").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        supabase.from("crew_contacts").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
        supabase.from("project_locations").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
      ]);

      setProject(projRes.data ?? null);
      setCollaborators((collabsRes.data as ProjectCollaborator[]) ?? []);
      setMessages((msgsRes.data as ProjectMessage[]) ?? []);
      setShotLists((shotRes.data as ShotList[]) ?? []);
      setTasks((tasksRes.data as ProjectTask[]) ?? []);
      setCrew((crewRes.data as CrewContact[]) ?? []);
      setLocations((locRes.data as ProjectLocation[]) ?? []);

      // Load notes via API route (handles permission check server-side)
      const notesRes = await fetch(`/api/collab/${projectId}/notes`);
      if (notesRes.ok) setNotes(await notesRes.json());

      const [scheduleRes, filesRes] = await Promise.all([
        fetch(`/api/collab/${projectId}/schedule`),
        fetch(`/api/collab/${projectId}/files`),
      ]);
      if (scheduleRes.ok) {
        const sd = await scheduleRes.json();
        setMyCollaboratorId(sd.my_collaborator_id ?? "");
        setShootDays(sd.shoot_days ?? []);
      }
      if (filesRes.ok) setCollabFiles(await filesRes.json());

      setLoading(false);
    }

    load();
  }, [projectId, router]);

  useEffect(() => {
    if (activeTab === "chat") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`collab_msgs:${projectId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "project_messages",
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as ProjectMessage];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    const res = await fetch(`/api/projects/${projectId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, author_name: displayName || "Collaborator" }),
    });
    if (!res.ok) setInput(content);
    setSending(false);
    inputRef.current?.focus();
  }

  const toggleTaskStatus = useCallback(async (task: ProjectTask) => {
    if (!myPermissions.includes("manage_tasks")) return;
    const next = task.status === "done" ? "todo" : "done";
    setTogglingTask(task.id);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next as ProjectTask["status"] } : t));
    try {
      const res = await fetch(`/api/collab/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
        toast.error("Failed to update task");
      }
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
      toast.error("Something went wrong");
    } finally {
      setTogglingTask(null);
    }
  }, [projectId, myPermissions]);

  const toggleShot = useCallback(async (itemId: string, current: boolean) => {
    if (!myPermissions.includes("mark_shots")) return;
    setTogglingShot(itemId);
    const next = !current;
    setShotLists((prev) => prev.map((sl) => ({
      ...sl,
      items: sl.items?.map((s) => s.id === itemId ? { ...s, is_complete: next } : s),
    })));
    try {
      const res = await fetch(`/api/collab/${projectId}/shots/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_complete: next }),
      });
      if (!res.ok) {
        setShotLists((prev) => prev.map((sl) => ({
          ...sl,
          items: sl.items?.map((s) => s.id === itemId ? { ...s, is_complete: current } : s),
        })));
        toast.error("Failed to update shot");
      } else if (next) {
        // Marked done — prompt for a completion note
        setPendingNoteForShot(itemId);
        setShotNoteInput("");
        setTimeout(() => shotNoteRef.current?.focus(), 50);
      }
    } catch {
      setShotLists((prev) => prev.map((sl) => ({
        ...sl,
        items: sl.items?.map((s) => s.id === itemId ? { ...s, is_complete: current } : s),
      })));
    } finally {
      setTogglingShot(null);
    }
  }, [projectId, myPermissions]);

  const saveShotNote = useCallback(async (itemId: string) => {
    const note = shotNoteInput.trim();
    setPendingNoteForShot(null);
    setShotNoteInput("");
    if (!note) return;
    setShotLists((prev) => prev.map((sl) => ({
      ...sl,
      items: sl.items?.map((s) => s.id === itemId ? { ...s, completion_note: note } : s),
    })));
    await fetch(`/api/collab/${projectId}/shots/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_complete: true, completion_note: note }),
    });
  }, [projectId, shotNoteInput]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    const content = noteContent.trim();
    if (!content || savingNote) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/collab/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title: noteTitle.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add note");
      } else {
        setNotes((prev) => [data, ...prev]);
        setNoteContent("");
        setNoteTitle("");
        setAddingNote(false);
        toast.success("Note added");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const grouped: { date: string; msgs: ProjectMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else grouped.push({ date, msgs: [msg] });
  }

  const crewByDept = new Map<string, CrewContact[]>();
  for (const c of crew) {
    const dept = c.department || "Other";
    if (!crewByDept.has(dept)) crewByDept.set(dept, []);
    crewByDept.get(dept)!.push(c);
  }
  const orderedDepts = new Map<string, CrewContact[]>();
  for (const d of DEPT_ORDER) if (crewByDept.has(d)) orderedDepts.set(d, crewByDept.get(d)!);
  for (const [d, v] of crewByDept) if (!orderedDepts.has(d)) orderedDepts.set(d, v);

  const canMarkShots = myPermissions.includes("mark_shots");
  const canManageTasks = myPermissions.includes("manage_tasks");
  const canAddNotes = myPermissions.includes("add_notes");

  const todoTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0b]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d4a853] border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0b]">
        <p className="text-sm text-white/30">Project not found.</p>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "chat",     label: "Chat",      icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: "schedule", label: "Schedule",  icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: "shots",    label: "Shot List", icon: <Camera className="h-3.5 w-3.5" /> },
    { id: "tasks",    label: "Tasks",     icon: <CheckSquare className="h-3.5 w-3.5" /> },
    { id: "notes",    label: "Notes",     icon: <StickyNote className="h-3.5 w-3.5" /> },
    { id: "files",    label: "Files",     icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "info",     label: "Info",      icon: <Info className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-screen flex-col bg-[#0b0b0b] text-white overflow-hidden">
      <div className="pointer-events-none fixed left-0 top-0 h-64 w-full bg-[radial-gradient(ellipse_60%_40%_at_30%_0%,rgba(212,168,83,0.06),transparent)]" />

      {/* Header */}
      <header className="shrink-0 border-b border-white/[0.06] px-4 py-3.5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/collab")} className="text-white/30 hover:text-white/60 transition-colors shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/12">
                <Film className="h-3 w-3 text-[#d4a853]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{project.title}</p>
                {project.client_name && <p className="text-[10px] text-white/30 truncate">{project.client_name}</p>}
              </div>
            </div>
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${statusStyle(project.status)}`}>
              {project.status}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPeople((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                showPeople ? "border-[#d4a853]/30 text-[#d4a853]" : "border-white/10 text-white/40 hover:text-white hover:border-white/20"
              }`}
            >
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">People</span>
              {collaborators.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px]">
                  {collaborators.length}
                </span>
              )}
            </button>
            {displayName && <span className="hidden sm:block text-xs text-white/40">{displayName}</span>}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/40 hover:text-white hover:border-white/20 transition-colors"
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white/[0.08] text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "tasks" && todoTasks.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d4a853]/20 px-1 text-[9px] font-bold text-[#d4a853]">
                  {todoTasks.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

          {/* ── Chat ── */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-0.5">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
                    <p className="text-sm text-white/20">No messages yet — say hello!</p>
                  </div>
                ) : (
                  grouped.map(({ date, msgs }) => (
                    <div key={date}>
                      <div className="flex items-center gap-3 py-3">
                        <div className="h-px flex-1 bg-white/[0.06]" />
                        <span className="text-[10px] text-white/20">{date}</span>
                        <div className="h-px flex-1 bg-white/[0.06]" />
                      </div>
                      {msgs.map((msg, i) => {
                        const isMe = msg.author_id === userId;
                        const prevMsg = i > 0 ? msgs[i - 1] : null;
                        const showAuthor = !prevMsg || prevMsg.author_id !== msg.author_id;
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${showAuthor ? "mt-3" : "mt-0.5"}`}>
                            {showAuthor && (
                              <span className={`mb-1 text-[10px] text-white/30 ${isMe ? "mr-1" : "ml-9"}`}>
                                {isMe ? "You" : msg.author_name}
                              </span>
                            )}
                            <div className="flex items-end gap-2">
                              {!isMe && (
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/50">
                                  {msg.author_name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className={`max-w-sm rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                isMe
                                  ? "bg-[#d4a853] text-black rounded-br-sm"
                                  : "bg-white/[0.06] text-white/90 rounded-bl-sm"
                              }`}>
                                {msg.content}
                              </div>
                              <span className="text-[9px] text-white/15 shrink-0">{formatTime(msg.created_at)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              <div className="shrink-0 border-t border-white/[0.06] p-4">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Message the team…"
                    disabled={sending}
                    className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#d4a853]/30 transition-colors"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#d4a853] text-black transition-opacity disabled:opacity-30 hover:opacity-90"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Schedule ── */}
          {activeTab === "schedule" && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {shootDays.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
                  <CalendarDays className="h-8 w-8 text-white/10" />
                  <p className="text-sm text-white/20">No shoot days scheduled yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shootDays.map((day) => {
                    const dateStr = day.date
                      ? new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
                          weekday: "long", month: "long", day: "numeric", year: "numeric",
                        })
                      : null;
                    const myCall = day.crew_calls.find((cc) => cc.collaborator_id === myCollaboratorId);

                    function downloadIcs() {
                      if (!day.date) return;
                      const d = day.date.replace(/-/g, "");
                      const summary = `Day ${day.day_number} – ${project?.title ?? "Shoot"}`;
                      const location = day.location ?? "";
                      const desc = [
                        day.general_call ? `General Call: ${day.general_call}` : "",
                        myCall ? `Your Call: ${myCall.call_time}` : "",
                        location ? `Location: ${location}` : "",
                      ].filter(Boolean).join("\\n");
                      const ics = [
                        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CineFlow//EN",
                        "BEGIN:VEVENT",
                        `DTSTART;VALUE=DATE:${d}`,
                        `DTEND;VALUE=DATE:${d}`,
                        `SUMMARY:${summary}`,
                        `DESCRIPTION:${desc}`,
                        `LOCATION:${location}`,
                        "END:VEVENT", "END:VCALENDAR",
                      ].join("\r\n");
                      const blob = new Blob([ics], { type: "text/calendar" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = `day-${day.day_number}.ics`; a.click();
                      URL.revokeObjectURL(url);
                    }

                    return (
                      <div key={day.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                        {/* Personal call time banner */}
                        {myCall && (
                          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#d4a853]/10 border-b border-[#d4a853]/20">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-[#d4a853]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-[#d4a853]/60">Your Call Time</p>
                              <p className="text-base font-bold text-[#d4a853]">{myCall.call_time}</p>
                            </div>
                          </div>
                        )}

                        {/* Day header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-bold text-white/60">
                            {day.day_number}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white/80">Day {day.day_number}</p>
                            {dateStr && <p className="text-[10px] text-white/40">{dateStr}</p>}
                          </div>
                          {day.date && (
                            <button
                              onClick={downloadIcs}
                              className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/40 hover:text-[#d4a853] hover:border-[#d4a853]/30 transition-colors"
                              title="Add to calendar"
                            >
                              <Download className="h-3 w-3" />
                              Calendar
                            </button>
                          )}
                        </div>

                        {/* Day details */}
                        <div className="px-4 py-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-0.5">General Call</p>
                              <p className="text-sm font-semibold text-white/80">{day.general_call || "TBD"}</p>
                            </div>
                            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-0.5">Location</p>
                              <p className="text-sm font-semibold text-white/80 truncate">{day.location || "TBD"}</p>
                            </div>
                          </div>

                          {/* All crew call times */}
                          {day.crew_calls.length > 0 && (
                            <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2">Call Times</p>
                              <div className="space-y-1.5">
                                {day.crew_calls.map((cc) => (
                                  <div key={cc.id} className={`flex items-center gap-2 ${cc.collaborator_id === myCollaboratorId ? "opacity-100" : "opacity-70"}`}>
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs text-white/80">{cc.name}</span>
                                      {cc.role && <span className="ml-1.5 text-[10px] text-white/40">{cc.role}</span>}
                                    </div>
                                    <span className={`text-xs font-bold shrink-0 ${cc.collaborator_id === myCollaboratorId ? "text-[#d4a853]" : "text-white/60"}`}>
                                      {cc.call_time}
                                      {cc.collaborator_id === myCollaboratorId && <span className="ml-1 text-[9px] font-normal text-[#d4a853]/60">(you)</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {day.notes && (
                            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">Notes</p>
                              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{day.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Shot List ── */}
          {activeTab === "shots" && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {canMarkShots && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <p className="text-xs text-emerald-400">You can mark shots as complete on this project.</p>
                </div>
              )}

              {/* Day filter — only show if shoot days exist */}
              {shootDays.length > 0 && (
                <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                  <button
                    onClick={() => setShotDayFilter("all")}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${shotDayFilter === "all" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
                  >
                    All Shots
                  </button>
                  <button
                    onClick={() => setShotDayFilter("unassigned")}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${shotDayFilter === "unassigned" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
                  >
                    Unscheduled
                  </button>
                  {shootDays.map((day) => {
                    const dateShort = day.date
                      ? new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : null;
                    return (
                      <button
                        key={day.id}
                        onClick={() => setShotDayFilter(day.id)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${shotDayFilter === day.id ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
                      >
                        Day {day.day_number}{dateShort ? ` · ${dateShort}` : ""}
                      </button>
                    );
                  })}
                </div>
              )}

              {shotLists.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
                  <List className="h-8 w-8 text-white/10" />
                  <p className="text-sm text-white/20">No shot lists yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {shotLists.map((list) => {
                    const allItems = (list.items ?? []).slice().sort((a, b) => a.shot_number - b.shot_number);
                    const items = shotDayFilter === "all"
                      ? allItems
                      : shotDayFilter === "unassigned"
                      ? allItems.filter((s) => !s.shoot_day_id)
                      : allItems.filter((s) => s.shoot_day_id === shotDayFilter);
                    if (items.length === 0) return null;
                    return (
                      <div key={list.id}>
                        <div className="mb-3 flex items-center gap-2">
                          <div className="h-px flex-1 bg-white/[0.06]" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{list.title}</p>
                          <div className="h-px flex-1 bg-white/[0.06]" />
                        </div>
                        {items.length === 0 ? (
                          <p className="text-xs text-white/20 italic py-2">No shots added yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((shot) => (
                              <div
                                key={shot.id}
                                className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-all ${
                                  shot.is_complete ? "opacity-50" : ""
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Mark-complete button or shot number */}
                                  {canMarkShots ? (
                                    <button
                                      onClick={() => toggleShot(shot.id, shot.is_complete)}
                                      disabled={togglingShot === shot.id}
                                      className="mt-0.5 shrink-0 text-white/30 hover:text-emerald-400 transition-colors disabled:opacity-50"
                                    >
                                      {shot.is_complete
                                        ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                        : <Circle className="h-5 w-5" />
                                      }
                                    </button>
                                  ) : (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-bold text-white/50">
                                      {shot.shot_number}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                      {canMarkShots && (
                                        <span className="text-[10px] font-bold text-white/30">#{shot.shot_number}</span>
                                      )}
                                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#d4a853]/70">
                                        {SHOT_TYPE_LABELS[shot.shot_type] ?? shot.shot_type}
                                      </span>
                                      {shot.scene && (
                                        <span className="text-[10px] text-white/30">· Scene {shot.scene}</span>
                                      )}
                                      {shot.location && (
                                        <span className="text-[10px] text-white/30">· {shot.location}</span>
                                      )}
                                      {shot.is_complete && (
                                        <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                                          Done
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-white/80">{shot.description}</p>
                                    {shot.notes && (
                                      <p className="mt-1 text-xs text-white/40">{shot.notes}</p>
                                    )}
                                    {/* Completion note from collaborator */}
                                    {pendingNoteForShot === shot.id ? (
                                      <input
                                        ref={shotNoteRef}
                                        type="text"
                                        value={shotNoteInput}
                                        onChange={(e) => setShotNoteInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveShotNote(shot.id);
                                          if (e.key === "Escape") { setPendingNoteForShot(null); setShotNoteInput(""); }
                                        }}
                                        onBlur={() => saveShotNote(shot.id)}
                                        placeholder="Add a note… (Enter to save, Esc to skip)"
                                        className="mt-2 w-full rounded-lg bg-emerald-400/5 border border-emerald-400/20 px-2.5 py-1.5 text-xs text-emerald-400 placeholder-emerald-400/30 outline-none focus:border-emerald-400/40 transition-colors"
                                      />
                                    ) : shot.completion_note ? (
                                      <p className="mt-1.5 text-xs text-emerald-400/70 italic">
                                        &ldquo;{shot.completion_note}&rdquo;
                                      </p>
                                    ) : null}
                                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/30">
                                      {shot.camera_movement && shot.camera_movement !== "static" && (
                                        <span>Movement: {shot.camera_movement}</span>
                                      )}
                                      {shot.lens && <span>Lens: {shot.lens}</span>}
                                      {shot.duration_seconds && (
                                        <span>Duration: {shot.duration_seconds}s</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tasks ── */}
          {activeTab === "tasks" && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {!canManageTasks && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <p className="text-xs text-white/30">View only — ask your project lead for task management access.</p>
                </div>
              )}
              {tasks.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
                  <CheckSquare className="h-8 w-8 text-white/10" />
                  <p className="text-sm text-white/20">No tasks yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {todoTasks.length > 0 && (
                    <div>
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
                        Open · {todoTasks.length}
                      </p>
                      <div className="space-y-2">
                        {todoTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            canToggle={canManageTasks}
                            toggling={togglingTask === task.id}
                            onToggle={() => toggleTaskStatus(task)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {doneTasks.length > 0 && (
                    <div>
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
                        Completed · {doneTasks.length}
                      </p>
                      <div className="space-y-2 opacity-50">
                        {doneTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            canToggle={canManageTasks}
                            toggling={togglingTask === task.id}
                            onToggle={() => toggleTaskStatus(task)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Notes ── */}
          {activeTab === "notes" && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {/* Add note form */}
              {canAddNotes && (
                <div className="mb-4">
                  {addingNote ? (
                    <form onSubmit={handleAddNote} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2">
                      <input
                        type="text"
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="Title (optional)"
                        className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#d4a853]/30 transition-colors"
                      />
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Write your note…"
                        rows={3}
                        required
                        className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#d4a853]/30 transition-colors resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={!noteContent.trim() || savingNote}
                          className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                          {savingNote ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : null}
                          Save note
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingNote(false); setNoteContent(""); setNoteTitle(""); }}
                          className="rounded-lg border border-white/10 px-4 py-1.5 text-xs text-white/40 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setAddingNote(true)}
                      className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-transparent px-4 py-3 text-xs text-white/30 hover:border-[#d4a853]/30 hover:text-[#d4a853] transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add a note
                    </button>
                  )}
                </div>
              )}

              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <StickyNote className="h-8 w-8 text-white/10" />
                  <p className="text-sm text-white/20">
                    {canAddNotes ? "No notes yet — add the first one." : "No notes yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      {note.title && (
                        <p className="text-sm font-semibold text-white mb-1">{note.title}</p>
                      )}
                      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-white/25">
                        {note.author_name && (
                          <span className="font-medium text-white/40">{note.author_name}</span>
                        )}
                        {note.author_name && <span>·</span>}
                        <span>
                          {new Date(note.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Files ── */}
          {activeTab === "files" && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {collabFiles.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
                  <FileText className="h-8 w-8 text-white/10" />
                  <p className="text-sm text-white/20">No files shared yet.</p>
                </div>
              ) : (
                (() => {
                  const CREW_FILE_CATS: { key: string; label: string }[] = [
                    { key: "call-sheets",  label: "Call Sheets" },
                    { key: "breakdowns",   label: "Breakdowns" },
                    { key: "schedules",    label: "Schedules" },
                    { key: "notes",        label: "Production Notes" },
                    { key: "other",        label: "Other" },
                  ];
                  function fmtSize(bytes?: number) {
                    if (!bytes) return "";
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                  }
                  const populated = CREW_FILE_CATS.filter((cat) =>
                    collabFiles.some((f) => (f.category ?? "other") === cat.key)
                  );
                  return (
                    <div className="space-y-4">
                      {populated.map((cat) => {
                        const catFiles = collabFiles.filter((f) => (f.category ?? "other") === cat.key);
                        return (
                          <div key={cat.key}>
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">{cat.label}</p>
                            <div className="space-y-1.5">
                              {catFiles.map((file) => (
                                <div key={file.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                                  <FileText className="h-4 w-4 shrink-0 text-[#d4a853]/60" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-white/80 truncate">{file.name}</p>
                                    {file.size && (
                                      <p className="text-[10px] text-white/30">{fmtSize(file.size)}</p>
                                    )}
                                  </div>
                                  {file.public_url && (
                                    <a
                                      href={file.public_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:border-[#d4a853]/40 hover:text-[#d4a853] transition-colors"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Open
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* ── Info ── */}
          {activeTab === "info" && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/30">Project</p>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                  <p className="text-sm font-semibold text-white">{project.title}</p>
                  {project.client_name && (
                    <p className="text-xs text-white/50">Client: {project.client_name}</p>
                  )}
                  {project.shoot_date && (
                    <div className="flex items-center gap-1.5 text-xs text-[#d4a853]">
                      <Clock className="h-3 w-3 shrink-0" />
                      Shoot:{" "}
                      {new Date(project.shoot_date).toLocaleDateString([], {
                        weekday: "long", month: "long", day: "numeric", year: "numeric",
                      })}
                    </div>
                  )}
                  {project.description && (
                    <p className="text-xs text-white/40 leading-relaxed">{project.description}</p>
                  )}
                </div>
              </div>

              {locations.length > 0 && (
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
                    Locations · {locations.length}
                  </p>
                  <div className="space-y-2">
                    {locations.map((loc) => (
                      <div key={loc.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                        <p className="text-sm font-medium text-white">{loc.name}</p>
                        {loc.address && (
                          <div className="mt-1 flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-white/30" />
                            <p className="text-xs text-white/50">{loc.address}</p>
                          </div>
                        )}
                        {loc.contact_name && (
                          <p className="mt-1 text-xs text-white/40">Contact: {loc.contact_name}</p>
                        )}
                        {loc.contact_phone && (
                          <a href={`tel:${loc.contact_phone}`} className="mt-0.5 flex items-center gap-1 text-xs text-[#d4a853] hover:underline">
                            <Phone className="h-3 w-3" />
                            {loc.contact_phone}
                          </a>
                        )}
                        {loc.maps_url && (
                          <a href={loc.maps_url} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-1 text-xs text-blue-400 hover:underline">
                            <Globe className="h-3 w-3" />
                            Open in Maps
                          </a>
                        )}
                        {loc.notes && (
                          <p className="mt-1.5 text-xs text-white/30 leading-relaxed">{loc.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {crew.length > 0 && (
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
                    Crew · {crew.length}
                  </p>
                  <div className="space-y-4">
                    {Array.from(orderedDepts.entries()).map(([dept, members]) => (
                      <div key={dept}>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/20">{dept}</p>
                        <div className="space-y-1.5">
                          {members.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-white/80 truncate">{c.name}</p>
                                <p className="text-[10px] text-white/30 truncate">{c.role}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {c.phone && (
                                  <a href={`tel:${c.phone}`} className="text-white/30 hover:text-[#d4a853] transition-colors">
                                    <Phone className="h-3 w-3" />
                                  </a>
                                )}
                                {c.email && (
                                  <a href={`mailto:${c.email}`} className="text-white/30 hover:text-[#d4a853] transition-colors">
                                    <Mail className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {locations.length === 0 && crew.length === 0 && !project.shoot_date && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Info className="h-8 w-8 text-white/10" />
                  <p className="mt-2 text-sm text-white/20">No additional info yet.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* People sidebar */}
        {showPeople && (
          <div className="hidden sm:flex w-56 shrink-0 flex-col border-l border-white/[0.06] overflow-y-auto">
            <div className="px-4 pt-4 pb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">On this project</p>
              {collaborators.length === 0 ? (
                <p className="text-xs text-white/20 italic">Just you for now.</p>
              ) : (
                <div className="space-y-2.5">
                  {collaborators.map((c) => {
                    const isYou = c.user_id === userId;
                    return (
                      <div key={c.id} className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/50">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/80 truncate">
                            {c.name}{isYou ? " (you)" : ""}
                          </p>
                          {c.role && (
                            <p className="text-[10px] text-[#d4a853]/60 truncate">{c.role}</p>
                          )}
                        </div>
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  canToggle,
  toggling,
  onToggle,
}: {
  task: ProjectTask;
  canToggle: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  const isDone = task.status === "done";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <button
        onClick={onToggle}
        disabled={!canToggle || toggling}
        className={`mt-0.5 shrink-0 transition-colors ${
          canToggle
            ? "text-white/30 hover:text-emerald-400 cursor-pointer"
            : "text-white/15 cursor-default"
        } disabled:opacity-50`}
      >
        {isDone
          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          : <Circle className="h-4 w-4" />
        }
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${isDone ? "line-through text-white/30" : "text-white/80"}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 text-xs text-white/30 leading-relaxed">{task.description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {task.assignee_name && (
            <span className="text-[10px] text-white/30">→ {task.assignee_name}</span>
          )}
          {task.due_date && (
            <span className="flex items-center gap-0.5 text-[10px] text-white/30">
              <Clock className="h-2.5 w-2.5" />
              {new Date(task.due_date).toLocaleDateString([], { month: "short", day: "numeric" })}
            </span>
          )}
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold capitalize ${TASK_PRIORITY_COLOR[task.priority]}`}>
            {task.priority}
          </span>
        </div>
      </div>
    </div>
  );
}
