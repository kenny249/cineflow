"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type Flag = {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  show_new_badge: boolean;
  gated: boolean;
  expires_at: string | null;
  updated_at: string;
};

// ── Friendly labels ───────────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  clients: "Clients",
  retainers: "Retainers",
  crew: "Crew",
  calendar: "Calendar",
  boards: "Boards",
  storyboard: "Storyboard",
  "shot-lists": "Shot Lists",
  scripts: "Scripts",
  revisions: "Video Review",
  "project-tasks": "Project Tasks",
  tasks: "To Do",
  "editor-tools": "Editor Tools",
  drones: "Drones",
  contracts: "Contracts",
  forms: "Forms",
  finance: "Finance",
  "quote-calculator": "Quote Calculator",
  team: "Team",
  settings: "Settings",
  "beta-feedback": "Feedback",
};

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  color = "emerald",
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  color?: "emerald" | "gold" | "red" | "violet";
  disabled?: boolean;
}) {
  const activeColor = {
    emerald: "bg-emerald-500",
    gold: "bg-[#d4a853]",
    red: "bg-red-500",
    violet: "bg-violet-500",
  }[color];

  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        checked ? activeColor : "bg-zinc-700",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── Duration helpers ──────────────────────────────────────────────────────────

const DURATIONS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "∞", days: null },
];

function formatExpiry(iso: string | null): string {
  if (!iso) return "No expiry";
  const d = new Date(iso);
  const now = new Date();
  if (d <= now) return "Expired";
  const days = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  return `${days}d left — ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function expiresAt(days: number | null): string | null {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── Maintenance mode panel ────────────────────────────────────────────────────

function MaintenancePanel() {
  const [on, setOn] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((r) => r.json())
      .then((d) => {
        setOn(d.maintenance_mode ?? false);
        setMessage(d.maintenance_message ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save(updates: { maintenance_mode?: boolean; maintenance_message?: string }) {
    setSaving(true);
    const res = await fetch("/api/admin/site-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    if (!res.ok) toast.error("Failed to save");
  }

  async function toggleMaintenance() {
    const next = !on;
    setOn(next);
    await save({ maintenance_mode: next });
    toast[next ? "warning" : "success"](
      next ? "Maintenance mode ON — site blocked for users" : "Site is live again"
    );
  }

  async function saveMessage() {
    await save({ maintenance_message: message });
    toast.success("Message saved");
  }

  if (!loaded) return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 animate-pulse h-32" />
  );

  return (
    <div className={cn(
      "rounded-xl border p-5 transition-colors",
      on
        ? "border-red-500/30 bg-red-500/[0.04]"
        : "border-white/[0.06] bg-white/[0.02]"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
            on ? "border-red-500/30 bg-red-500/10" : "border-white/[0.08] bg-white/[0.04]"
          )}>
            <AlertTriangle className={cn("h-4 w-4", on ? "text-red-400" : "text-zinc-500")} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Emergency Maintenance Mode</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Blocks the entire site for all non-admin users
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {on && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 animate-pulse">
              LIVE
            </span>
          )}
          <Toggle checked={on} onChange={toggleMaintenance} color="red" disabled={saving} />
        </div>
      </div>

      {on && (
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message shown to users on /maintenance page"
            className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40"
          />
          <button
            onClick={saveMessage}
            disabled={saving}
            className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ── Feature row ───────────────────────────────────────────────────────────────

function FeatureRow({ flag, onUpdate }: { flag: Flag; onUpdate: (patch: Partial<Flag>) => void }) {
  const [saving, setSaving] = useState(false);
  const label = LABELS[flag.key] ?? flag.key;

  async function patch(updates: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch("/api/admin/feature-flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: flag.id, ...updates }),
    });
    setSaving(false);
    if (res.ok) {
      onUpdate(updates as Partial<Flag>);
    } else {
      toast.error("Failed to save");
    }
  }

  async function toggleEnabled() {
    await patch({ enabled: !flag.enabled });
  }

  async function toggleBadge() {
    const next = !flag.show_new_badge;
    await patch({ show_new_badge: next, expires_at: next ? null : null });
  }

  async function setDuration(days: number | null) {
    const exp = expiresAt(days);
    await patch({ expires_at: exp, show_new_badge: true });
    toast.success(days === null ? "Badge set to permanent" : `Badge expires in ${days} days`);
  }

  async function toggleGated() {
    await patch({ gated: !flag.gated });
    toast[!flag.gated ? "warning" : "success"](
      !flag.gated ? `${label} is now gated (non-admins blocked)` : `${label} is now accessible`
    );
  }

  const isExpired = flag.expires_at ? new Date(flag.expires_at) <= new Date() : false;

  return (
    <div className={cn(
      "flex flex-col gap-2 border-b border-white/[0.04] px-5 py-4 last:border-0 transition-opacity",
      !flag.enabled && "opacity-50"
    )}>
      {/* Row: name + controls */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Name */}
        <div className="min-w-[130px] flex-1">
          <p className="text-sm font-medium text-white">{label}</p>
          {flag.description && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{flag.description}</p>
          )}
        </div>

        {/* Enabled */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-600 w-14 text-right">Enabled</span>
          <Toggle checked={flag.enabled} onChange={toggleEnabled} disabled={saving} color="emerald" />
        </div>

        {/* NEW Badge */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-600 w-[60px] text-right">NEW badge</span>
          <Toggle
            checked={flag.show_new_badge && !isExpired}
            onChange={toggleBadge}
            disabled={saving || !flag.enabled}
            color="gold"
          />
          {flag.show_new_badge && !isExpired && (
            <span className="rounded-full bg-[#d4a853] px-1.5 py-0.5 text-[8px] font-bold leading-none text-black">
              NEW
            </span>
          )}
        </div>

        {/* Duration picker — only when badge is on */}
        {flag.show_new_badge && (
          <div className="flex items-center gap-1.5">
            {DURATIONS.map(({ label: dl, days }) => (
              <button
                key={dl}
                onClick={() => setDuration(days)}
                disabled={saving || !flag.enabled}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                  days === null && flag.expires_at === null
                    ? "bg-[#d4a853]/20 text-[#d4a853] border border-[#d4a853]/30"
                    : days !== null && flag.expires_at !== null &&
                      Math.abs(new Date(flag.expires_at).getTime() - expiresAt(days)!.length) < 1000
                    ? "bg-[#d4a853]/20 text-[#d4a853] border border-[#d4a853]/30"
                    : "bg-white/[0.04] text-zinc-500 border border-white/[0.06] hover:text-white hover:bg-white/[0.08]"
                )}
              >
                {dl}
              </button>
            ))}
          </div>
        )}

        {/* Gate */}
        <div className="flex items-center gap-2 ml-auto">
          <Lock className={cn("h-3.5 w-3.5", flag.gated ? "text-violet-400" : "text-zinc-700")} />
          <span className="text-[11px] text-zinc-600 w-[60px]">Gate page</span>
          <Toggle
            checked={flag.gated}
            onChange={toggleGated}
            disabled={saving}
            color="violet"
          />
        </div>
      </div>

      {/* Expiry info */}
      {flag.show_new_badge && (
        <p className={cn(
          "text-[11px] pl-0",
          isExpired ? "text-red-400" : "text-zinc-600"
        )}>
          {isExpired ? "Badge expired" : `Badge: ${formatExpiry(flag.expires_at)}`}
        </p>
      )}
      {flag.gated && (
        <p className="text-[11px] text-violet-500">
          Gated — non-admin users are redirected to /dashboard
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FeatureFlagsClient({ initial }: { initial: Flag[] }) {
  const [flags, setFlags] = useState(initial);

  function update(id: string, patch: Partial<Flag>) {
    setFlags((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
  }

  // Sort: known keys first (by LABELS order), then unknown alphabetically
  const knownOrder = Object.keys(LABELS);
  const sorted = [...flags].sort((a, b) => {
    const ai = knownOrder.indexOf(a.key);
    const bi = knownOrder.indexOf(b.key);
    if (ai === -1 && bi === -1) return a.key.localeCompare(b.key);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const activeCount = flags.filter((f) => f.enabled).length;
  const badgeCount = flags.filter((f) => f.show_new_badge && f.enabled && (!f.expires_at || new Date(f.expires_at) > new Date())).length;
  const gatedCount = flags.filter((f) => f.gated).length;

  return (
    <div className="space-y-5">
      {/* Maintenance mode */}
      <MaintenancePanel />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active features", value: activeCount },
          { label: "NEW badges live", value: badgeCount },
          { label: "Pages gated", value: gatedCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-lg font-bold text-white">{value}</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Feature list */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Features</p>
          <p className="text-xs text-zinc-600">{flags.length} total</p>
        </div>

        {/* Column headers */}
        <div className="hidden md:flex items-center gap-4 border-b border-white/[0.04] px-5 py-2">
          <p className="flex-1 text-[10px] font-medium uppercase tracking-widest text-zinc-700">Feature</p>
          <p className="w-[90px] text-right text-[10px] font-medium uppercase tracking-widest text-zinc-700">Enabled</p>
          <p className="w-[90px] text-right text-[10px] font-medium uppercase tracking-widest text-zinc-700">NEW badge</p>
          <p className="w-[120px] text-[10px] font-medium uppercase tracking-widest text-zinc-700">Duration</p>
          <p className="w-[100px] text-right text-[10px] font-medium uppercase tracking-widest text-zinc-700">Gate page</p>
        </div>

        {sorted.map((flag) => (
          <FeatureRow
            key={flag.id}
            flag={flag}
            onUpdate={(patch) => update(flag.id, patch)}
          />
        ))}
      </div>

      <p className="text-xs text-zinc-700">
        Gated pages redirect non-admin users to /dashboard. Maintenance mode blocks the entire site.
        NEW badges auto-hide when the expiry date passes.
      </p>
    </div>
  );
}
