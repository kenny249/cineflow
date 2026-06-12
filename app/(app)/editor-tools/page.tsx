"use client";

import { useState, useEffect } from "react";
import { Wrench, Clock, Calculator, MonitorPlay, Mic2 } from "lucide-react";
import { getEditSessions } from "@/lib/supabase/queries";
import type { EditSession } from "@/types";
import { SessionLog } from "@/components/editor-tools/SessionLog";
import { TimecodeCalc } from "@/components/editor-tools/TimecodeCalc";
import { DeliverySpecs } from "@/components/editor-tools/DeliverySpecs";
import { AudioTranscriber } from "@/components/editor-tools/AudioTranscriber";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "log",        label: "Session Log",   icon: Clock },
  { key: "timecode",   label: "Timecode Calc", icon: Calculator },
  { key: "delivery",   label: "Delivery Specs",icon: MonitorPlay },
  { key: "transcribe", label: "Transcribe",    icon: Mic2 },
] as const;

type Tab = typeof TABS[number]["key"];

export default function EditorToolsPage() {
  const [tab, setTab]           = useState<Tab>("log");
  const [sessions, setSessions] = useState<EditSession[]>([]);
  const [loading, setLoading]   = useState(true);
  // Persist active tab in URL hash so refresh restores the same tab
  useEffect(() => {
    const hash = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.key === hash)) setTab(hash);
  }, []);

  function handleTabChange(key: Tab) {
    setTab(key);
    window.history.replaceState(null, "", `#${key}`);
  }

  useEffect(() => {
    getEditSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  function handleAdd(session: EditSession) {
    setSessions((prev) => [session, ...prev]);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d4a853]/10 border border-[#d4a853]/20">
          <Wrench className="h-4 w-4 text-[#d4a853]" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Editor Tools</h1>
          <p className="text-[11px] text-muted-foreground/50">Session logging, timecode math, delivery specs, and audio transcription</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 border-b border-border px-6">
        <div className="flex gap-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150",
                tab === key
                  ? "border-[#d4a853] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", tab === key ? "text-[#d4a853]" : "text-muted-foreground")} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content — transcribe gets full height workspace, others get scrollable padding */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "log" && (
          <div className="h-full overflow-y-auto custom-scrollbar px-6 py-6">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-[#d4a853]" />
              </div>
            ) : (
              <SessionLog sessions={sessions} onDelete={handleDelete} onAdd={handleAdd} />
            )}
          </div>
        )}
        {tab === "timecode" && (
          <div className="h-full overflow-y-auto custom-scrollbar px-6 py-6">
            <TimecodeCalc />
          </div>
        )}
        {tab === "delivery" && (
          <div className="h-full overflow-y-auto custom-scrollbar px-6 py-6">
            <DeliverySpecs />
          </div>
        )}
        {tab === "transcribe" && <AudioTranscriber />}
      </div>
    </div>
  );
}
