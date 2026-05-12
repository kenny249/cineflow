"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Mail, Clock, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import type { ProjectCollaborator } from "@/types";

interface CollaboratorsTabProps {
  projectId: string;
}

export function CollaboratorsTab({ projectId }: CollaboratorsTabProps) {
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/collaborators`);
    if (res.ok) {
      const data = await res.json();
      setCollaborators(data);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();
    if (!email || !name) return;
    setInviting(true);

    const res = await fetch(`/api/projects/${projectId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to send invite");
    } else {
      toast.success(`Invite sent to ${email}`);
      setCollaborators((prev) => [...prev, data]);
      setInviteEmail("");
      setInviteName("");
    }
    setInviting(false);
  }

  async function handleRemove(collab: ProjectCollaborator) {
    setRemovingId(collab.id);
    const res = await fetch(
      `/api/projects/${projectId}/collaborators?collaboratorId=${collab.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setCollaborators((prev) => prev.filter((c) => c.id !== collab.id));
      toast.success(`${collab.name} removed`);
    } else {
      toast.error("Failed to remove collaborator");
    }
    setRemovingId(null);
  }

  return (
    <div className="p-5 sm:p-6 space-y-6">
      <div>
        <h3 className="font-display text-sm font-semibold text-foreground">Project Collaborators</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Invite crew, clients, or partners to access this project and join the project chat.
        </p>
      </div>

      {/* Invite form */}
      <form onSubmit={handleInvite} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5 text-[#d4a853]" /> Invite someone
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Full name"
            required
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#d4a853]/50 transition-colors"
          />
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            required
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#d4a853]/50 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {inviting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {inviting ? "Sending…" : "Send invite"}
        </button>
      </form>

      {/* Collaborator list */}
      <div>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
            Loading…
          </div>
        ) : collaborators.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <Mail className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No collaborators yet — send your first invite above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {collaborators.map((collab) => (
              <div
                key={collab.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-white/50">
                    {collab.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{collab.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{collab.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {collab.status === "active" ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                  <button
                    onClick={() => handleRemove(collab)}
                    disabled={removingId === collab.id}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                  >
                    {removingId === collab.id ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
