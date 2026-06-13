"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

type Flag = {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  show_new_badge: boolean;
  user_ids: string[] | null;
  plans: string[] | null;
  updated_at: string;
};

export function FeatureFlagsClient({ initial }: { initial: Flag[] }) {
  const [flags, setFlags] = useState(initial);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!key.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, description, enabled: false }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      setFlags((prev) => [json.flag, ...prev]);
      setKey("");
      setDescription("");
      toast.success("Flag created");
    } else {
      toast.error(json.error ?? "Failed to create");
    }
  }

  async function toggle(id: string, enabled: boolean) {
    const res = await fetch("/api/admin/feature-flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !enabled }),
    });
    if (res.ok) {
      setFlags((prev) => prev.map((f) => f.id === id ? { ...f, enabled: !enabled } : f));
    } else {
      toast.error("Failed to toggle");
    }
  }

  async function toggleBadge(id: string, show_new_badge: boolean) {
    const res = await fetch("/api/admin/feature-flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, show_new_badge: !show_new_badge }),
    });
    if (res.ok) {
      setFlags((prev) => prev.map((f) => f.id === id ? { ...f, show_new_badge: !show_new_badge } : f));
    } else {
      toast.error("Failed to toggle badge");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this feature flag?")) return;
    const res = await fetch(`/api/admin/feature-flags?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setFlags((prev) => prev.filter((f) => f.id !== id));
      toast.success("Deleted");
    } else {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">New feature flag</h2>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <input
              type="text"
              placeholder="flag_key (e.g. new_dashboard)"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#d4a853]/40"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#d4a853]/40"
            />
          </div>
          <button
            onClick={create}
            disabled={saving || !key.trim()}
            className="flex items-center gap-1.5 self-start rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-bold text-black hover:bg-[#e0b55e] disabled:opacity-40 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {flags.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-600">No feature flags yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Key", "Description", "Targeting", "Enabled", "New Badge", "Updated", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-200">{f.key}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{f.description ?? <span className="text-zinc-700">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {f.plans?.length ? `Plans: ${f.plans.join(", ")}` : f.user_ids?.length ? `${f.user_ids.length} users` : "Global"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(f.id, f.enabled)} className="text-zinc-400 hover:text-white transition-colors">
                      {f.enabled
                        ? <ToggleRight className="h-5 w-5 text-emerald-400" />
                        : <ToggleLeft className="h-5 w-5 text-zinc-600" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleBadge(f.id, f.show_new_badge)} className="text-zinc-400 hover:text-white transition-colors">
                        {f.show_new_badge
                          ? <ToggleRight className="h-5 w-5 text-[#d4a853]" />
                          : <ToggleLeft className="h-5 w-5 text-zinc-600" />
                        }
                      </button>
                      {f.show_new_badge && (
                        <span className="rounded-full bg-[#d4a853] px-1.5 py-0.5 text-[9px] font-bold leading-none text-black">NEW</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(f.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => remove(f.id)} className="text-zinc-700 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-zinc-700">
        Use <code className="font-mono text-zinc-500">isFeatureEnabled(key, {"{ userId, plan }"}) </code> in server components to gate features.
      </p>
    </div>
  );
}
