"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ContactRound, Plus, Search, Star, MapPin, Mail, Phone, Globe,
  Instagram, ExternalLink, X, Edit2, Trash2, Globe2, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getMyCrewProfiles, getPublicCrewProfiles,
  createCrewProfile, updateCrewProfile, deleteCrewProfile, bulkCreateCrewProfiles,
} from "@/lib/supabase/queries";
import type { CrewProfile, CrewAvailability } from "@/types";
import { CREW_ROLES } from "@/types";
import { CsvImportModal, type ImportRow } from "@/components/crew/CsvImportModal";

// ── constants ─────────────────────────────────────────────────────────────────

const AVAIL_LABEL: Record<CrewAvailability, string> = {
  available: "Available",
  booked: "Booked",
  unavailable: "Unavailable",
};
const AVAIL_COLOR: Record<CrewAvailability, string> = {
  available: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  booked: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  unavailable: "text-zinc-400 border-zinc-500/20 bg-zinc-500/10",
};

const EMPTY_FORM = {
  name: "", primary_role: "Director of Photography (DP)", roles: [] as string[],
  city: "", state: "", email: "", phone: "", website: "", instagram: "",
  reel_url: "", bio: "", notes: "", rating: 0, skills: [] as string[],
  gear: [] as string[], day_rate_min: "" as string | number,
  day_rate_max: "" as string | number, availability: "available" as CrewAvailability,
};

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(value === n ? 0 : n)}
          className={cn(
            "h-4 w-4 transition-colors",
            n <= value ? "text-[#d4a853]" : "text-muted-foreground/30 hover:text-[#d4a853]/60"
          )}
        >
          <Star className="h-full w-full fill-current" />
        </button>
      ))}
    </div>
  );
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder }: {
  tags: string[]; onChange: (t: string[]) => void; placeholder?: string;
}) {
  const [val, setVal] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/,+$/, "");
    if (t && !tags.includes(t) && tags.length < 20) onChange([...tags, t]);
  };
  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[36px] rounded-md border border-border bg-input px-3 py-1.5 cursor-text"
      onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
    >
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px]">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}>
            <X className="h-2.5 w-2.5 text-muted-foreground hover:text-red-400" />
          </button>
        </span>
      ))}
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(val); setVal(""); }
          else if (e.key === "Backspace" && !val && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => { if (val.trim()) { add(val); setVal(""); } }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[100px] bg-transparent text-xs outline-none placeholder:text-muted-foreground/50 py-0.5"
      />
    </div>
  );
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

function CrewModal({
  initial, onClose, onSave,
}: {
  initial?: CrewProfile;
  onClose: () => void;
  onSave: (p: CrewProfile) => void;
}) {
  const [form, setForm] = useState(initial ? {
    name: initial.name, primary_role: initial.primary_role,
    roles: initial.roles, city: initial.city ?? "", state: initial.state ?? "",
    email: initial.email ?? "", phone: initial.phone ?? "",
    website: initial.website ?? "", instagram: initial.instagram ?? "",
    reel_url: initial.reel_url ?? "", bio: initial.bio ?? "",
    notes: initial.notes ?? "", rating: initial.rating ?? 0,
    skills: initial.skills, gear: initial.gear,
    day_rate_min: initial.day_rate_min ?? "" as string | number,
    day_rate_max: initial.day_rate_max ?? "" as string | number,
    availability: initial.availability,
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        day_rate_min: form.day_rate_min !== "" ? Number(form.day_rate_min) : undefined,
        day_rate_max: form.day_rate_max !== "" ? Number(form.day_rate_max) : undefined,
        rating: form.rating || undefined,
        country: "US",
        is_public: false, // only the crew member themselves can make their profile public
      };
      let result: CrewProfile;
      if (initial) {
        result = await updateCrewProfile(initial.id, payload);
      } else {
        result = await createCrewProfile(payload as Parameters<typeof createCrewProfile>[0]);
      }
      onSave(result);
      toast.success(initial ? "Profile updated" : "Added to your crew network");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-base font-semibold">{initial ? "Edit crew member" : "Add to your crew network"}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Everything here is private to you. They control their own public profile.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <input value={form.name} onChange={(e) => f("name", e.target.value)} required placeholder="Jane Smith"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Primary role *</label>
              <select value={form.primary_role} onChange={(e) => f("primary_role", e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none">
                {CREW_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* City + State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <input value={form.city} onChange={(e) => f("city", e.target.value)} placeholder="Los Angeles"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">State</label>
              <input value={form.state} onChange={(e) => f("state", e.target.value)} placeholder="CA"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input type="email" value={form.email} onChange={(e) => f("email", e.target.value)} placeholder="jane@studio.com"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="+1 (555) 000-0000"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Instagram</label>
              <input value={form.instagram} onChange={(e) => f("instagram", e.target.value)} placeholder="@username"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Website</label>
              <input value={form.website} onChange={(e) => f("website", e.target.value)} placeholder="https://..."
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reel / Portfolio URL</label>
            <input value={form.reel_url} onChange={(e) => f("reel_url", e.target.value)} placeholder="https://vimeo.com/..."
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
          </div>

          {/* Day rate */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Day rate min ($)</label>
              <input type="number" value={form.day_rate_min} onChange={(e) => f("day_rate_min", e.target.value)} placeholder="500"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Day rate max ($)</label>
              <input type="number" value={form.day_rate_max} onChange={(e) => f("day_rate_max", e.target.value)} placeholder="1200"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none" />
            </div>
          </div>

          {/* Skills + Gear */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Skills & Certifications</label>
            <TagInput tags={form.skills} onChange={(t) => f("skills", t)} placeholder="Add skills (press Enter)" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Gear</label>
            <TagInput tags={form.gear} onChange={(t) => f("gear", t)} placeholder="Add gear (press Enter)" />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Bio / About</label>
            <textarea value={form.bio} onChange={(e) => f("bio", e.target.value)} rows={2}
              placeholder="Brief description of their style, experience, specialties…"
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none resize-none" />
          </div>

          {/* Rating + Availability */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Your rating (private)</label>
              <div className="pt-1"><StarRating value={form.rating} onChange={(v) => f("rating", v)} /></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Availability (as you know it)</label>
              <select value={form.availability} onChange={(e) => f("availability", e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none">
                <option value="available">Available</option>
                <option value="booked">Booked</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>

          {/* Private notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Private notes</label>
            <textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} rows={2}
              placeholder="e.g. Great with run-and-gun, slow turnaround on edits. Good for branded content."
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none resize-none" />
          </div>

          {/* Info box — no toggle, they control discoverability */}
          <div className="rounded-lg border border-border bg-muted/10 px-3 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Discoverability is their choice.</span>{" "}
              This profile is private to you. If you invite them to CineFlow, they can choose to appear in the public crew search.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gold" size="sm" disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : initial ? "Save changes" : "Add to network"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Crew card ─────────────────────────────────────────────────────────────────

function CrewCard({
  profile, onEdit, onDelete, isDiscover,
}: {
  profile: CrewProfile;
  onEdit?: () => void;
  onDelete?: () => void;
  isDiscover?: boolean;
}) {
  const initials = profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 flex flex-col gap-3 hover:border-border/80 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/10 text-[#d4a853] text-sm font-bold border border-[#d4a853]/20">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{profile.name}</p>
            {profile.is_claimed && (
              <span className="rounded-full bg-[#d4a853]/10 border border-[#d4a853]/20 px-1.5 py-0.5 text-[9px] font-semibold text-[#d4a853] uppercase tracking-wide">CineFlow</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{profile.primary_role}</p>
          {(profile.city || profile.state) && (
            <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {[profile.city, profile.state].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", AVAIL_COLOR[profile.availability])}>
            {AVAIL_LABEL[profile.availability]}
          </span>
          {!isDiscover && profile.rating ? <StarRating value={profile.rating} /> : null}
        </div>
      </div>

      {/* Day rate */}
      {(profile.day_rate_min || profile.day_rate_max) && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {profile.day_rate_min && profile.day_rate_max
              ? `$${profile.day_rate_min.toLocaleString()}–$${profile.day_rate_max.toLocaleString()}`
              : profile.day_rate_min
                ? `From $${profile.day_rate_min.toLocaleString()}`
                : `Up to $${profile.day_rate_max!.toLocaleString()}`}
          </span>
          {" "}/ day
        </p>
      )}

      {/* Skills */}
      {profile.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.skills.slice(0, 4).map((s) => (
            <span key={s} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">{s}</span>
          ))}
          {profile.skills.length > 4 && (
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">+{profile.skills.length - 4}</span>
          )}
        </div>
      )}

      {/* Private notes (only in My Network) */}
      {!isDiscover && profile.notes && (
        <p className="text-[11px] text-muted-foreground/70 italic border-t border-border pt-2">"{profile.notes}"</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border pt-2">
        {profile.email && (
          <a href={`mailto:${profile.email}`} title="Email" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        {profile.phone && (
          <a href={`tel:${profile.phone}`} title="Call" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
        {profile.instagram && (
          <a href={`https://instagram.com/${profile.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" title="Instagram" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Instagram className="h-3.5 w-3.5" />
          </a>
        )}
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noopener noreferrer" title="Website" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Globe className="h-3.5 w-3.5" />
          </a>
        )}
        {profile.reel_url && (
          <a href={profile.reel_url} target="_blank" rel="noopener noreferrer" title="Reel" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {profile.slug && profile.is_public && (
          <a href={`/crew/${profile.slug}`} target="_blank" rel="noopener noreferrer" title="Public profile" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Globe2 className="h-3.5 w-3.5" />
          </a>
        )}
        {!isDiscover && (
          <div className="ml-auto flex gap-1">
            <button onClick={onEdit} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Edit">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Remove ${profile.name} from your crew network?`)) onDelete?.();
              }}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CrewPage() {
  const [tab, setTab] = useState<"network" | "discover">("network");
  const [myProfiles, setMyProfiles] = useState<CrewProfile[]>([]);
  const [publicProfiles, setPublicProfiles] = useState<CrewProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  // My Network filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [availFilter, setAvailFilter] = useState("");

  // Discover filters
  const [discoverCity, setDiscoverCity] = useState("");
  const [discoverRole, setDiscoverRole] = useState("");
  const [discoverSkill, setDiscoverSkill] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTarget, setEditTarget] = useState<CrewProfile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getMyCrewProfiles()
      .then(setMyProfiles)
      .catch(() => toast.error("Failed to load crew"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = myProfiles;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.primary_role.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.skills.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (roleFilter) list = list.filter((p) => p.primary_role === roleFilter);
    if (availFilter) list = list.filter((p) => p.availability === availFilter);
    return list;
  }, [myProfiles, search, roleFilter, availFilter]);

  async function handleDiscover() {
    setDiscoverLoading(true);
    setHasSearched(true);
    try {
      const results = await getPublicCrewProfiles({
        role: discoverRole || undefined,
        city: discoverCity || undefined,
        skill: discoverSkill || undefined,
      });
      setPublicProfiles(results);
    } catch {
      toast.error("Search failed");
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteCrewProfile(id);
      setMyProfiles((prev) => prev.filter((p) => p.id !== id));
      toast.success("Removed from network");
    } catch {
      toast.error("Failed to remove");
    } finally {
      setDeletingId(null);
    }
  }

  const myRoles = useMemo(() => [...new Set(myProfiles.map((p) => p.primary_role))].sort(), [myProfiles]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <ContactRound className="h-4 w-4 text-[#d4a853]" />
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Crew Network</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowImport(true)}>
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </Button>
          <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setEditTarget(null); setShowModal(true); }}>
            <Plus className="h-3.5 w-3.5" />
            Add Person
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-border px-5">
        {(["network", "discover"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "py-2.5 px-1 mr-5 text-xs font-medium border-b-2 transition-colors",
              tab === t
                ? "border-[#d4a853] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "network" ? `My Network (${myProfiles.length})` : "Discover"}
          </button>
        ))}
      </div>

      {/* My Network tab */}
      {tab === "network" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Filters */}
          <div className="shrink-0 flex items-center gap-2 border-b border-border px-5 py-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, role, city, skill…"
                className="w-full rounded-lg border border-border bg-muted/30 py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:border-[#d4a853]/40 focus:outline-none">
              <option value="">All roles</option>
              {myRoles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={availFilter} onChange={(e) => setAvailFilter(e.target.value)}
              className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground focus:border-[#d4a853]/40 focus:outline-none">
              <option value="">Any availability</option>
              <option value="available">Available</option>
              <option value="booked">Booked</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
              </div>
            )}
            {!loading && myProfiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <ContactRound className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm font-semibold text-foreground">No crew yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">Add the editors, DPs, sound mixers, and freelancers you work with. Your notes and ratings stay private.</p>
                <Button variant="gold" size="sm" className="mt-2" onClick={() => setShowModal(true)}>+ Add your first person</Button>
              </div>
            )}
            {!loading && myProfiles.length > 0 && filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-10">No results for your search.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <CrewCard
                  key={p.id}
                  profile={p}
                  onEdit={() => { setEditTarget(p); setShowModal(true); }}
                  onDelete={() => handleDelete(p.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Discover tab */}
      {tab === "discover" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="shrink-0 border-b border-border px-5 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">Search film professionals who've opted into the CineFlow network.</p>
            <div className="flex gap-2 flex-wrap">
              <input value={discoverRole} onChange={(e) => setDiscoverRole(e.target.value)}
                placeholder="Role (e.g. Editor)"
                className="flex-1 min-w-[140px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none" />
              <input value={discoverCity} onChange={(e) => setDiscoverCity(e.target.value)}
                placeholder="City (e.g. Austin)"
                onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
                className="flex-1 min-w-[140px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none" />
              <input value={discoverSkill} onChange={(e) => setDiscoverSkill(e.target.value)}
                placeholder="Skill (e.g. RED Operator)"
                onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
                className="flex-1 min-w-[140px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none" />
              <Button variant="gold" size="sm" onClick={handleDiscover} disabled={discoverLoading} className="shrink-0">
                {discoverLoading ? "Searching…" : "Search"}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
            {discoverLoading && (
              <div className="flex items-center justify-center py-20">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
              </div>
            )}
            {!discoverLoading && !hasSearched && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                <Search className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">Enter a role, city, or skill and hit Search.</p>
              </div>
            )}
            {!discoverLoading && hasSearched && publicProfiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                <p className="text-sm font-semibold text-foreground">No results found</p>
                <p className="text-xs text-muted-foreground max-w-xs">The network grows as more film professionals join CineFlow. Try a broader search or add people from your own network.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {!discoverLoading && publicProfiles.map((p) => (
                <CrewCard key={p.id} profile={p} isDiscover />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <CrewModal
          initial={editTarget ?? undefined}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSave={(p) => {
            if (editTarget) {
              setMyProfiles((prev) => prev.map((x) => x.id === p.id ? p : x));
            } else {
              setMyProfiles((prev) => [...prev, p]);
            }
            setShowModal(false);
            setEditTarget(null);
          }}
        />
      )}

      {/* CSV import modal */}
      {showImport && (
        <CsvImportModal
          existingEmails={new Set(myProfiles.map((p) => p.email?.toLowerCase() ?? "").filter(Boolean))}
          onClose={() => setShowImport(false)}
          onImport={async (selected: ImportRow[]) => {
            const payloads = selected.map((row) => ({
              name: row.name,
              primary_role: row.detectedRole ?? "Other",
              roles: row.detectedRole ? [row.detectedRole] : [],
              email: row.email || undefined,
              phone: row.phone || undefined,
              city: row.city || undefined,
              country: "",
              skills: [],
              gear: [],
              rating: 0,
              availability: "available" as CrewAvailability,
              is_public: false,
            }));
            const created = await bulkCreateCrewProfiles(payloads);
            setMyProfiles((prev) => [...prev, ...created]);
            setShowImport(false);
            toast.success(`Imported ${created.length} contact${created.length !== 1 ? "s" : ""}`);
          }}
        />
      )}
    </div>
  );
}
