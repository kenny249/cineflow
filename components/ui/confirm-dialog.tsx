"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// A single, app-wide replacement for window.confirm() — mounted once at
// the root (see app/layout.tsx) so any component anywhere can call
// useConfirm() and get back a styled dialog instead of the browser's own
// native popup, which was the one moment in an otherwise fully custom UI
// where a jarring stock OS dialog broke the whole feel.

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in red with a warning icon, for anything destructive/irreversible. */
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const normalized: ConfirmOptions = typeof options === "string" ? { description: options } : options;
    return new Promise<boolean>((resolve) => setState({ options: normalized, resolve }));
  }, []);

  function settle(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onOpenChange={(open) => { if (!open) settle(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              {state?.options.destructive && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
              )}
              <DialogTitle>{state?.options.title ?? "Are you sure?"}</DialogTitle>
            </div>
            <DialogDescription className="pt-1">{state?.options.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => settle(false)}>
              {state?.options.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={state?.options.destructive ? "destructive" : "default"} onClick={() => settle(true)}>
              {state?.options.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** Returns an async confirm(...) — drop-in replacement for window.confirm() that returns a Promise<boolean> instead of a synchronous one, and renders as a styled dialog instead of a native popup. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm() must be called within ConfirmDialogProvider (mounted in app/layout.tsx)");
  return ctx;
}
