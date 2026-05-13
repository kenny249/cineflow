"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import type { EditSession, EditSessionCategory } from "@/types";
import { createEditSession } from "@/lib/supabase/queries";

const LS_KEY = "cf_edit_session";

interface ActiveSession {
  startedAt: number;
  category: EditSessionCategory;
  title: string;
}

interface EditSessionContextValue {
  active: ActiveSession | null;
  elapsed: number; // seconds
  startSession: (category: EditSessionCategory, title: string) => void;
  endSession: () => Promise<EditSession | null>;
  cancelSession: () => void;
}

const EditSessionContext = createContext<EditSessionContextValue>({
  active: null,
  elapsed: 0,
  startSession: () => {},
  endSession: async () => null,
  cancelSession: () => {},
});

export function useEditSession() {
  return useContext(EditSessionContext);
}

export function EditSessionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore active session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveSession;
        if (parsed?.startedAt) {
          setActive(parsed);
          setElapsed(Math.floor((Date.now() - parsed.startedAt) / 1000));
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Tick elapsed every second while a session is active
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!active) return;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - active.startedAt) / 1000));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  const startSession = useCallback((category: EditSessionCategory, title: string) => {
    const session: ActiveSession = { startedAt: Date.now(), category, title };
    localStorage.setItem(LS_KEY, JSON.stringify(session));
    setActive(session);
    setElapsed(0);
  }, []);

  const cancelSession = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setActive(null);
    setElapsed(0);
  }, []);

  const endSession = useCallback(async (): Promise<EditSession | null> => {
    if (!active) return null;
    const duration = Math.max(1, Math.floor((Date.now() - active.startedAt) / 1000));
    const snapshot = { ...active };
    localStorage.removeItem(LS_KEY);
    setActive(null);
    setElapsed(0);
    try {
      return await createEditSession({
        title: snapshot.title,
        category: snapshot.category,
        duration_secs: duration,
      });
    } catch {
      return null;
    }
  }, [active]);

  return (
    <EditSessionContext.Provider value={{ active, elapsed, startSession, endSession, cancelSession }}>
      {children}
    </EditSessionContext.Provider>
  );
}
