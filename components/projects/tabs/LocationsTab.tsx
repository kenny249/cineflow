"use client";

import { useEffect, useState } from "react";
import { Plus, MapPin, Phone, ExternalLink, Trash2, Edit3, Check, Map } from "lucide-react";
import { getProjectLocations, createProjectLocation, updateProjectLocation, deleteProjectLocation } from "@/lib/supabase/queries";
import type { ProjectLocation } from "@/types";
import { toast } from "sonner";

interface LocationsTabProps {
  projectId: string;
  canEdit: boolean;
}

interface LocationForm {
  name: string;
  address: string;
  maps_url: string;
  contact_name: string;
  contact_phone: string;
  notes: string;
}

const EMPTY: LocationForm = { name: "", address: "", maps_url: "", contact_name: "", contact_phone: "", notes: "" };

export function LocationsTab({ projectId, canEdit }: LocationsTabProps) {
  const [locations, setLocations] = useState<ProjectLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getProjectLocations(projectId).then(setLocations).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Location name is required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateProjectLocation(editingId, { ...form });
        setLocations((prev) => prev.map((l) => l.id === editingId ? { ...l, ...updated } : l));
        toast.success("Location updated");
      } else {
        const created = await createProjectLocation({ project_id: projectId, ...form, sort_order: locations.length });
        setLocations((prev) => [...prev, created]);
        toast.success("Location added");
      }
      setShowAdd(false); setEditingId(null); setForm(EMPTY);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteProjectLocation(id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
      toast.success("Removed");
    } catch { toast.error("Failed to delete"); }
    finally { setDeletingId(null); }
  }

  function startEdit(loc: ProjectLocation) {
    setForm({ name: loc.name, address: loc.address || "", maps_url: loc.maps_url || "", contact_name: loc.contact_name || "", contact_phone: loc.contact_phone || "", notes: loc.notes || "" });
    setEditingId(loc.id); setShowAdd(true);
  }

  // Try to auto-build a Google Maps embed from address or maps_url
  function getMapsEmbed(loc: ProjectLocation): string | null {
    if (loc.maps_url && loc.maps_url.includes("maps.google.com")) {
      // Convert share URL to embed
      return loc.maps_url.replace("/maps/", "/maps/embed/v1/place").replace("?", "?key=AIzaSyD-PLACEHOLDER&q=").split("?")[0] + "?pb=" + (loc.maps_url.split("?pb=")[1] ?? "");
    }
    if (loc.address) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(loc.address)}&output=embed`;
    }
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 sm:px-5 py-3">
        <p className="text-sm font-semibold text-foreground">{locations.length} location{locations.length !== 1 ? "s" : ""}</p>
        {canEdit && (
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); setForm(EMPTY); }}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add location
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <div className="shrink-0 border-b border-border bg-muted/10 px-4 sm:px-5 py-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{editingId ? "Edit Location" : "New Location"}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className="loc-input sm:col-span-2" placeholder="Location name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="loc-input sm:col-span-2" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <input className="loc-input sm:col-span-2" placeholder="Google Maps share URL (optional)" value={form.maps_url} onChange={(e) => setForm({ ...form, maps_url: e.target.value })} />
            <input className="loc-input" placeholder="Location contact name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            <input className="loc-input" placeholder="Contact phone" type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            <textarea className="loc-input sm:col-span-2 resize-none" rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

      {/* List */}
      <div className="px-4 sm:px-5 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
          </div>
        ) : locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Map className="mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="font-display font-semibold">No locations added</p>
            <p className="mt-1 text-sm text-muted-foreground">Add shoot locations with addresses and contact info</p>
          </div>
        ) : (
          locations.map((loc) => {
            const isExpanded = expandedId === loc.id;
            const embedUrl = getMapsEmbed(loc);
            return (
              <div key={loc.id} className="overflow-hidden rounded-xl border border-border bg-card/50">
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-card transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : loc.id)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/10">
                    <MapPin className="h-4 w-4 text-[#d4a853]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground">{loc.name}</p>
                    {loc.address && <p className="truncate text-xs text-muted-foreground">{loc.address}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {loc.maps_url && (
                      <a href={loc.maps_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-1.5 text-muted-foreground hover:text-[#d4a853] transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {canEdit && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); startEdit(loc); }} className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors sm:opacity-0 sm:group-hover:opacity-100"><Edit3 className="h-3.5 w-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(loc.id); }} disabled={deletingId === loc.id} className="rounded p-1.5 text-muted-foreground hover:text-red-400 transition-colors sm:opacity-0 sm:group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    {(loc.contact_name || loc.contact_phone) && (
                      <div className="flex flex-wrap gap-3 text-sm">
                        {loc.contact_name && <span className="text-foreground">{loc.contact_name}</span>}
                        {loc.contact_phone && (
                          <a href={`tel:${loc.contact_phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-[#d4a853] transition-colors">
                            <Phone className="h-3.5 w-3.5" />{loc.contact_phone}
                          </a>
                        )}
                      </div>
                    )}
                    {loc.notes && <p className="text-sm text-muted-foreground">{loc.notes}</p>}
                    {embedUrl && (
                      <div className="overflow-hidden rounded-lg border border-border">
                        <iframe
                          src={embedUrl}
                          width="100%"
                          height="220"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title={loc.name}
                        />
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => startEdit(loc)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><Edit3 className="h-3 w-3" />Edit</button>
                        <button onClick={() => handleDelete(loc.id)} className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="h-3 w-3" />Remove</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        .loc-input { width: 100%; border-radius: 0.5rem; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); padding: 0.375rem 0.75rem; font-size: 0.875rem; color: hsl(var(--foreground)); outline: none; }
        .loc-input:focus { border-color: rgba(212,168,83,0.5); box-shadow: 0 0 0 1px rgba(212,168,83,0.3); }
        .loc-input::placeholder { color: hsl(var(--muted-foreground)); }
      `}</style>
    </div>
  );
}
