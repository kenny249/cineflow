"use client";

import { useEffect, useState } from "react";
import { Plus, Phone, Mail, Trash2, Edit3, Check, X, Users } from "lucide-react";
import { getCrewContacts, createCrewContact, updateCrewContact, deleteCrewContact } from "@/lib/supabase/queries";
import type { CrewContact } from "@/types";
import { toast } from "sonner";

const DEPARTMENTS = ["Direction", "Camera", "Lighting", "Sound", "Art", "Wardrobe", "Hair & Makeup", "Production", "Post", "Other"];

interface CrewTabProps {
  projectId: string;
  canEdit: boolean;
}

function groupByDept(crew: CrewContact[]): Record<string, CrewContact[]> {
  return crew.reduce<Record<string, CrewContact[]>>((acc, c) => {
    const dept = c.department || "Other";
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(c);
    return acc;
  }, {});
}

interface CrewForm {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  notes: string;
}

const EMPTY_FORM: CrewForm = { name: "", role: "", department: "Production", email: "", phone: "", notes: "" };

export function CrewTab({ projectId, canEdit }: CrewTabProps) {
  const [crew, setCrew] = useState<CrewContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CrewForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getCrewContacts(projectId).then(setCrew).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  async function handleSave() {
    if (!form.name.trim() || !form.role.trim()) { toast.error("Name and role are required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateCrewContact(editingId, { ...form });
        setCrew((prev) => prev.map((c) => c.id === editingId ? { ...c, ...updated } : c));
        toast.success("Contact updated");
      } else {
        const created = await createCrewContact({ project_id: projectId, ...form, sort_order: crew.length });
        setCrew((prev) => [...prev, created]);
        toast.success("Crew member added");
      }
      setShowAdd(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteCrewContact(id);
      setCrew((prev) => prev.filter((c) => c.id !== id));
      toast.success("Removed");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  function startEdit(contact: CrewContact) {
    setForm({ name: contact.name, role: contact.role, department: contact.department || "Production", email: contact.email || "", phone: contact.phone || "", notes: contact.notes || "" });
    setEditingId(contact.id);
    setShowAdd(true);
  }

  const filtered = search.trim()
    ? crew.filter((c) => `${c.name} ${c.role} ${c.department} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase()))
    : crew;
  const grouped = groupByDept(filtered);
  const depts = Object.keys(grouped).sort();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 sm:px-5 py-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search crew…"
          className="flex-1 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
        />
        {canEdit && (
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); setForm(EMPTY_FORM); }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <div className="shrink-0 border-b border-border bg-muted/10 px-4 sm:px-5 py-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{editingId ? "Edit Contact" : "New Crew Member"}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <input className="col-span-2 sm:col-span-1 input-base" placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input-base" placeholder="Role / Job title *" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            <select className="input-base" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <input className="input-base" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input-base" placeholder="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="col-span-2 sm:col-span-1 input-base" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-60"
            >
              {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Crew list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-5 py-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
          </div>
        ) : crew.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="font-display font-semibold text-foreground">No crew added yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your crew members and their contact info</p>
          </div>
        ) : (
          depts.map((dept) => (
            <div key={dept}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{dept}</p>
              <div className="space-y-2">
                {grouped[dept].map((contact) => (
                  <div key={contact.id} className="group flex items-start gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 transition-colors hover:bg-card">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/10 text-sm font-bold text-[#d4a853]">
                      {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                        <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{contact.role}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[#d4a853] transition-colors">
                            <Mail className="h-3 w-3" />{contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[#d4a853] transition-colors">
                            <Phone className="h-3 w-3" />{contact.phone}
                          </a>
                        )}
                      </div>
                      {contact.notes && <p className="mt-1 text-xs text-muted-foreground/70">{contact.notes}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <button onClick={() => startEdit(contact)} className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"><Edit3 className="h-3.5 w-3.5" /></button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          disabled={deletingId === contact.id}
                          className="rounded p-1 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .input-base {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.375rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          outline: none;
        }
        .input-base:focus {
          border-color: rgba(212,168,83,0.5);
          box-shadow: 0 0 0 1px rgba(212,168,83,0.3);
        }
        .input-base::placeholder {
          color: hsl(var(--muted-foreground));
        }
        select.input-base option {
          background: hsl(var(--background));
          color: hsl(var(--foreground));
        }
      `}</style>
    </div>
  );
}
