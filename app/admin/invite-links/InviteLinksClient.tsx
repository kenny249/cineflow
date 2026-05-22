"use client";

import { useState, useTransition } from "react";
import { Plus, Copy, Trash2, Check, Crown, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type InviteLink = {
  id: string;
  code: string;
  plan: string;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
};

export function InviteLinksClient({ links: initial, appUrl }: { links: InviteLink[]; appUrl: string }) {
  const [links, setLinks] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [plan, setPlan] = useState("lifetime");
  const [maxUses, setMaxUses] = useState("1");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${appUrl}/invite/${code}`);
    setCopied(code);
    toast.success("Link copied!");
    setTimeout(() => setCopied(null), 2000);
  }

  function generate() {
    startTransition(async () => {
      const res = await fetch("/api/admin/invite-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, max_uses: parseInt(maxUses) || 1, notes: notes.trim() || null }),
      });
      const json = await res.json();
      if (res.ok) {
        setLinks([json.link, ...links]);
        setShowForm(false);
        setNotes("");
        toast.success("Invite link created");
      } else {
        toast.error("Failed to create link");
      }
    });
  }

  function deleteLink(id: string) {
    if (!confirm("Delete this invite link?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/invite-links?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setLinks(links.filter((l) => l.id !== id));
        toast.success("Link deleted");
      } else {
        toast.error("Failed to delete");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Generate button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-[#d4a853] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Generate link
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-5">
          <p className="mb-4 text-sm font-semibold text-white">New invite link</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white focus:outline-none"
              >
                {["lifetime", "solo", "studio", "agency"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Max uses</label>
              <input
                type="text"
                inputMode="numeric"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. For Marcus"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={isPending}
              className="rounded-xl bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              {isPending ? "Generating…" : "Generate"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Links list */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {links.length === 0 ? (
          <div className="py-16 text-center">
            <Link2 className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-600">No invite links yet. Generate one above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Link", "Plan", "Uses", "Notes", "Created", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const full = `${appUrl}/invite/${link.code}`;
                const exhausted = link.uses >= link.max_uses;
                return (
                  <tr key={link.id} className={cn("border-b border-white/[0.03]", exhausted && "opacity-50")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-300 font-mono">
                          /invite/{link.code}
                        </code>
                        <button onClick={() => copyLink(link.code)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                          {copied === link.code ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#d4a853]/10 border border-[#d4a853]/20 px-2 py-0.5 text-xs text-[#d4a853]">
                        {link.plan === "lifetime" && <Crown className="h-3 w-3" />}
                        {link.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      <span className={cn("text-xs", exhausted && "text-red-400")}>
                        {link.uses} / {link.max_uses}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{link.notes ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(link.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteLink(link.id)} className="text-zinc-700 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
