"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

type Announcement = {
  id: string;
  message: string;
  type: string;
  is_active: boolean;
  plans: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

const TYPE_STYLES: Record<string, string> = {
  info:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export function AnnouncementsClient({ initial }: { initial: Announcement[] }) {
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!message.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, type }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      setItems((prev) => [json.announcement, ...prev]);
      setMessage("");
      toast.success("Announcement created");
    } else {
      toast.error(json.error ?? "Failed to create");
    }
  }

  async function toggle(id: string, is_active: boolean) {
    const res = await fetch("/api/admin/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((a) => a.id === id ? { ...a, is_active: !is_active } : a));
    } else {
      toast.error("Failed to toggle");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    const res = await fetch(`/api/admin/announcements?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((a) => a.id !== id));
      toast.success("Deleted");
    } else {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">New announcement</h2>
        <div className="flex gap-3">
          <textarea
            placeholder="Message shown to users in the app banner…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#d4a853]/40 resize-none"
          />
          <div className="flex flex-col gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-zinc-300 focus:outline-none"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
            </select>
            <button
              onClick={create}
              disabled={saving || !message.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-bold text-black hover:bg-[#e0b55e] disabled:opacity-40 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-600">No announcements yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Message", "Type", "Active", "Created", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-zinc-300 max-w-xs">
                    <p className="truncate">{a.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${TYPE_STYLES[a.type] ?? ""}`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(a.id, a.is_active)} className="text-zinc-400 hover:text-white transition-colors">
                      {a.is_active
                        ? <ToggleRight className="h-5 w-5 text-emerald-400" />
                        : <ToggleLeft className="h-5 w-5 text-zinc-600" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => remove(a.id)} className="text-zinc-700 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
