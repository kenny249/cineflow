"use client";

import { useEffect, useState, useId } from "react";
import { Plus, Camera, Mic, Lightbulb, Wrench, Package, Trash2, Edit3, ChevronDown, ChevronUp, X, Tag } from "lucide-react";
import { getProjectEquipment, createProjectEquipment, updateProjectEquipment, deleteProjectEquipment } from "@/lib/supabase/queries";
import type { ProjectEquipment, EquipmentCategory, EquipmentLens } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ─── Presets ──────────────────────────────────────────────────────────────────

const CAMERA_BODIES = [
  // Cinema
  "ARRI ALEXA 35", "ARRI ALEXA Mini LV",
  "RED V-RAPTOR 8K", "RED KOMODO-X 6K", "RED MONSTRO 8K",
  "Blackmagic PYXIS 6K", "Blackmagic Pocket Cinema 6K Pro", "Blackmagic URSA Mini Pro 12K",
  // Professional Hybrid
  "Sony FX9", "Sony FX6", "Sony FX3", "Sony FX30", "Sony A7SIII", "Sony A7RV", "Sony ZV-E1",
  "Canon EOS C500 Mark II", "Canon EOS C300 Mark III", "Canon EOS C70",
  "Canon EOS R5C", "Canon EOS R5", "Canon EOS R6 Mark II",
  "Panasonic Lumix S5II", "Panasonic BS1H",
  "Nikon Z9", "Nikon Z8",
  // Specialty / Action
  "DJI Ronin 4D-6K", "DJI Inspire 3",
  "GoPro Hero 13 Black", "GoPro Hero 12 Black",
  "DJI Action 4", "Insta360 X4",
  // Mobile
  "iPhone 16 Pro", "iPhone 15 Pro",
  // Other
  "Handycam (Sony)", "Custom…",
];

const CAMERA_ROLES = [
  "Hero / Primary", "B-Cam / Secondary", "Safety Angle",
  "On-Stage / On-Talent", "Crowd / Audience", "BTS / Behind the Scenes",
  "Gimbal / Moving", "POV / Action", "Aerial / Drone",
  "Locked Wide", "Telephoto / Long", "Fan Message / Interactive",
  "Interview Setup", "Custom…",
];

const LENS_PRESETS: { label: string; focal: string; type: "prime" | "zoom" }[] = [
  { label: "14mm", focal: "14mm", type: "prime" },
  { label: "16mm", focal: "16mm", type: "prime" },
  { label: "20mm", focal: "20mm", type: "prime" },
  { label: "24mm", focal: "24mm", type: "prime" },
  { label: "28mm", focal: "28mm", type: "prime" },
  { label: "35mm", focal: "35mm", type: "prime" },
  { label: "40mm", focal: "40mm", type: "prime" },
  { label: "50mm", focal: "50mm", type: "prime" },
  { label: "85mm", focal: "85mm", type: "prime" },
  { label: "100mm", focal: "100mm", type: "prime" },
  { label: "135mm", focal: "135mm", type: "prime" },
  { label: "200mm", focal: "200mm", type: "prime" },
  { label: "10-18mm", focal: "10-18mm", type: "zoom" },
  { label: "16-35mm f/2.8", focal: "16-35mm", type: "zoom" },
  { label: "24-70mm f/2.8", focal: "24-70mm", type: "zoom" },
  { label: "24-105mm f/4", focal: "24-105mm", type: "zoom" },
  { label: "70-200mm f/2.8", focal: "70-200mm", type: "zoom" },
  { label: "100-400mm", focal: "100-400mm", type: "zoom" },
];

const AUDIO_ITEMS = [
  "Sound Devices MixPre-3 II", "Sound Devices MixPre-6 II", "Sound Devices 833", "Sound Devices 888",
  "Zoom H6 Essential", "Zoom F3", "Zoom F6",
  "Rode NTG5", "Rode NTG3", "Rode VideoMic Pro+", "Rode Wireless GO II", "Rode Wireless Pro",
  "Sennheiser MKH 416", "Sennheiser MKH 50", "Sennheiser EW 500 G4",
  "DJI Mic 2", "DJI Mic Mini", "Lectrosonics SMWB", "Tentacle Sync E",
  "Custom…",
];

const LIGHTING_ITEMS = [
  "Aputure 600D Pro", "Aputure 600c Pro", "Aputure 300X", "Aputure 120d II", "Aputure LS 600c",
  "Aputure MC (4-Light Kit)", "Aputure B7C",
  "Nanlite Forza 500B II", "Nanlite Forza 300B", "Nanlite Pavotube II 30C",
  "Godox SL-200W", "Godox SZ200Bi",
  "Creamsource Vortex8", "Quasar Science Rainbow 2",
  "Astera Titan Tube", "Astera Helios Tube",
  "LED Handheld Panel", "Practicals", "Custom…",
];

const SUPPORT_ITEMS = [
  "DJI RS4 Pro", "DJI RS3 Pro", "DJI RS3 Mini",
  "Tilta Float", "Easy Rig Vario 5",
  "Sachtler Ace XL", "Sachtler Video 18S", "Miller Arrow 55",
  "Dana Dolly", "Kessler Pocket Dolly", "Rhino Arc II Slider",
  "Matthews C-Stand", "Cardellini Clamp",
  "Shoulder Rig", "Monopod", "Tripod", "Gorilla Pod",
  "Teleprompter", "Follow Focus", "Matte Box",
  "Monitor (7″)", "Monitor (17″)", "Custom…",
];

// ─── Category config ──────────────────────────────────────────────────────────

type CatConfig = {
  label: string;
  icon: React.ElementType;
  color: string;
  items: string[];
  roles?: string[];
};

const CATEGORIES: Record<EquipmentCategory, CatConfig> = {
  camera:   { label: "Cameras",       icon: Camera,    color: "text-blue-400",   items: CAMERA_BODIES,  roles: CAMERA_ROLES },
  audio:    { label: "Audio",         icon: Mic,       color: "text-green-400",  items: AUDIO_ITEMS },
  lighting: { label: "Lighting",      icon: Lightbulb, color: "text-yellow-400", items: LIGHTING_ITEMS },
  support:  { label: "Support & Grip",icon: Wrench,    color: "text-orange-400", items: SUPPORT_ITEMS },
  other:    { label: "Other",         icon: Package,   color: "text-purple-400", items: ["Custom…"] },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Lens chip row ────────────────────────────────────────────────────────────

function LensRow({ lenses, onUpdate }: { lenses: EquipmentLens[]; onUpdate: (l: EquipmentLens[]) => void }) {
  const [customFocal, setCustomFocal] = useState("");
  const [customAperture, setCustomAperture] = useState("");

  function addPreset(p: typeof LENS_PRESETS[number]) {
    if (lenses.find((l) => l.focal_length === p.focal)) return;
    onUpdate([...lenses, { id: genId(), focal_length: p.focal, type: p.type }]);
  }

  function addCustom() {
    const f = customFocal.trim();
    if (!f) return;
    onUpdate([...lenses, { id: genId(), focal_length: f, aperture: customAperture.trim() || undefined, type: "prime" }]);
    setCustomFocal("");
    setCustomAperture("");
  }

  function remove(id: string) {
    onUpdate(lenses.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-2">
      {/* Current lenses */}
      {lenses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lenses.map((l) => (
            <span key={l.id} className="flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
              {l.focal_length}{l.aperture ? ` ${l.aperture}` : ""}
              <button type="button" onClick={() => remove(l.id)} className="hover:text-red-400 transition-colors"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
      )}

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1">
        {LENS_PRESETS.map((p) => {
          const active = !!lenses.find((l) => l.focal_length === p.focal);
          return (
            <button
              key={p.focal}
              type="button"
              onClick={() => active ? remove(lenses.find((l) => l.focal_length === p.focal)!.id) : addPreset(p)}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all ${active ? "border-blue-400/50 bg-blue-400/15 text-blue-300" : "border-border bg-muted/40 text-muted-foreground hover:border-blue-400/30 hover:text-blue-300"}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom lens */}
      <div className="flex gap-2">
        <Input
          placeholder="Custom focal length (e.g. 18mm)"
          value={customFocal}
          onChange={(e) => setCustomFocal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          className="h-7 text-xs"
        />
        <Input
          placeholder="f/2.8"
          value={customAperture}
          onChange={(e) => setCustomAperture(e.target.value)}
          className="h-7 w-20 text-xs"
        />
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addCustom}>Add</Button>
      </div>
    </div>
  );
}

// ─── Equipment form dialog ────────────────────────────────────────────────────

interface EquipmentFormProps {
  projectId: string;
  initial?: ProjectEquipment | null;
  defaultCategory?: EquipmentCategory;
  onSave: (item: ProjectEquipment) => void;
  onClose: () => void;
}

function EquipmentForm({ projectId, initial, defaultCategory = "camera", onSave, onClose }: EquipmentFormProps) {
  const [category, setCategory] = useState<EquipmentCategory>(initial?.category ?? defaultCategory);
  const [name, setName] = useState(initial?.name ?? "");
  const [customName, setCustomName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assigned_to ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [customRole, setCustomRole] = useState(initial?.role ?? "");
  const [lenses, setLenses] = useState<EquipmentLens[]>(initial?.lenses ?? []);
  const [isRental, setIsRental] = useState(initial?.is_rental ?? false);
  const [rentalVendor, setRentalVendor] = useState(initial?.rental_vendor ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serial_number ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const uid = useId();

  const cfg = CATEGORIES[category];
  const isCustomName = name === "Custom…" || !cfg.items.includes(name);
  const isCustomRole = role === "Custom…" || (cfg.roles && !cfg.roles.includes(role) && role !== "");
  const effectiveName = isCustomName ? customName : name;
  const effectiveRole = isCustomRole ? customRole : role;

  async function handleSave() {
    if (!effectiveName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload: Omit<ProjectEquipment, "id" | "created_at" | "updated_at"> = {
        project_id: projectId,
        category,
        name: effectiveName.trim(),
        brand: brand.trim() || null,
        assigned_to: assignedTo.trim() || null,
        role: effectiveRole.trim() || null,
        lenses,
        is_rental: isRental,
        rental_vendor: isRental ? rentalVendor.trim() || null : null,
        serial_number: serialNumber.trim() || null,
        notes: notes.trim() || null,
        sort_order: initial?.sort_order ?? 0,
      };
      let result: ProjectEquipment;
      if (initial) {
        result = await updateProjectEquipment(initial.id, payload);
      } else {
        result = await createProjectEquipment(payload);
      }
      onSave(result);
      toast.success(initial ? "Equipment updated" : "Equipment added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-sm font-semibold">{initial ? "Edit Equipment" : "Add Equipment"}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5">
          {/* Category tabs */}
          <div>
            <Label className="mb-1.5 block text-xs">Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(CATEGORIES) as [EquipmentCategory, CatConfig][]).map(([key, c]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setCategory(key); setName(""); setRole(""); }}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${category === key ? "border-[#d4a853]/50 bg-[#d4a853]/10 text-[#d4a853]" : "border-border bg-muted/40 text-muted-foreground hover:border-[#d4a853]/30"}`}
                >
                  <c.icon className="h-3 w-3" />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-name`}>
              {category === "camera" ? "Camera body" : "Item"} <span className="text-[#d4a853]">*</span>
            </Label>
            <select
              id={`${uid}-name`}
              value={isCustomName ? "Custom…" : name}
              onChange={(e) => { setName(e.target.value); if (e.target.value !== "Custom…") setCustomName(e.target.value); }}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50"
            >
              <option value="">Select {category === "camera" ? "camera body" : "item"}…</option>
              {cfg.items.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {isCustomName && (
              <Input
                placeholder={`Enter ${category === "camera" ? "camera body" : "item name"}…`}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            )}
          </div>

          {/* Brand (for camera, auto-detect; others manual) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-brand`}>Brand / Make</Label>
              <Input id={`${uid}-brand`} placeholder="e.g. Sony, Canon" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-assigned`}>Assigned to</Label>
              <Input id={`${uid}-assigned`} placeholder="Crew member name" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-role`}>{category === "camera" ? "Camera role / angle" : "Role / purpose"}</Label>
            {cfg.roles ? (
              <>
                <select
                  id={`${uid}-role`}
                  value={isCustomRole ? "Custom…" : role}
                  onChange={(e) => { setRole(e.target.value); if (e.target.value !== "Custom…") setCustomRole(e.target.value); }}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50"
                >
                  <option value="">Select role…</option>
                  {cfg.roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {isCustomRole && (
                  <Input placeholder="Describe the camera's role…" value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
                )}
              </>
            ) : (
              <Input id={`${uid}-role`} placeholder="e.g. Boom Op, Key Light, A-Rig" value={role} onChange={(e) => setRole(e.target.value)} />
            )}
          </div>

          {/* Lenses — only for cameras */}
          {category === "camera" && (
            <div className="space-y-1.5">
              <Label>Lenses</Label>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <LensRow lenses={lenses} onUpdate={setLenses} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-notes`}>Notes</Label>
            <textarea
              id={`${uid}-notes`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mount type, position, special instructions…"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50 resize-none"
            />
          </div>

          {/* Rental toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsRental(!isRental)}
              className={`relative h-5 w-9 rounded-full border transition-all ${isRental ? "border-[#d4a853]/50 bg-[#d4a853]/20" : "border-border bg-muted/30"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full border transition-all ${isRental ? "left-4 border-[#d4a853] bg-[#d4a853]" : "left-0.5 border-border bg-muted"}`} />
            </button>
            <span className="text-xs text-muted-foreground">Rental gear</span>
          </div>

          {isRental && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-vendor`}>Rental vendor</Label>
                <Input id={`${uid}-vendor`} placeholder="e.g. Keslow Camera" value={rentalVendor} onChange={(e) => setRentalVendor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-serial`}>Serial / asset #</Label>
                <Input id={`${uid}-serial`} placeholder="For insurance / checkout" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="button" variant="gold" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : initial ? "Save Changes" : "Add Equipment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function EquipmentSection({
  category,
  items,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  category: EquipmentCategory;
  items: ProjectEquipment[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (item: ProjectEquipment) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const cfg = CATEGORIES[category];
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted/30 ${cfg.color}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-foreground">{cfg.label}</span>
          {items.length > 0 && (
            <span className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{items.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground hover:border-[#d4a853]/40 hover:text-[#d4a853] transition-all"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Items */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No {cfg.label.toLowerCase()} added yet.</p>
              {canEdit && (
                <button type="button" onClick={onAdd} className="mt-2 text-xs text-[#d4a853] hover:underline">
                  + Add {cfg.label.toLowerCase().replace(/s$/, "")}
                </button>
              )}
            </div>
          ) : (
            items.map((item) => (
              <EquipmentCard
                key={item.id}
                item={item}
                canEdit={canEdit}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Equipment card ───────────────────────────────────────────────────────────

function EquipmentCard({ item, canEdit, onEdit, onDelete }: {
  item: ProjectEquipment;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cfg = CATEGORIES[item.category];
  const Icon = cfg.icon;

  return (
    <div className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/20 ${cfg.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{item.name}</span>
          {item.brand && <span className="rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">{item.brand}</span>}
          {item.is_rental && <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-1.5 py-0.5 text-[10px] text-orange-400">Rental</span>}
        </div>

        {(item.assigned_to || item.role) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.assigned_to}{item.assigned_to && item.role ? " · " : ""}{item.role}
          </p>
        )}

        {/* Lenses */}
        {item.lenses && item.lenses.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.lenses.map((l) => (
              <span key={l.id} className="rounded-full border border-blue-400/25 bg-blue-400/8 px-1.5 py-0.5 text-[10px] text-blue-300">
                {l.focal_length}{l.aperture ? ` ${l.aperture}` : ""}
              </span>
            ))}
          </div>
        )}

        {item.notes && <p className="mt-1 text-[11px] text-muted-foreground/70 italic">{item.notes}</p>}
      </div>

      {canEdit && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

interface EquipmentTabProps {
  projectId: string;
  canEdit: boolean;
  initialItems?: ProjectEquipment[];
}

export function EquipmentTab({ projectId, canEdit, initialItems }: EquipmentTabProps) {
  const [items, setItems] = useState<ProjectEquipment[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogCategory, setDialogCategory] = useState<EquipmentCategory>("camera");
  const [editingItem, setEditingItem] = useState<ProjectEquipment | null>(null);

  useEffect(() => {
    if (initialItems) return;
    getProjectEquipment(projectId).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [projectId, initialItems]);

  function openAdd(cat: EquipmentCategory) {
    setEditingItem(null);
    setDialogCategory(cat);
    setDialogOpen(true);
  }

  function openEdit(item: ProjectEquipment) {
    setEditingItem(item);
    setDialogCategory(item.category);
    setDialogOpen(true);
  }

  function handleSaved(item: ProjectEquipment) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
    setDialogOpen(false);
    setEditingItem(null);
  }

  async function handleDelete(id: string) {
    try {
      await deleteProjectEquipment(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Removed");
    } catch {
      toast.error("Failed to delete");
    }
  }

  const byCategory = (cat: EquipmentCategory) => items.filter((i) => i.category === cat);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  const totalItems = items.length;

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">Equipment</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {totalItems === 0 ? "Camera package, audio, lighting, and support gear for this production." : `${totalItems} item${totalItems !== 1 ? "s" : ""} across ${new Set(items.map((i) => i.category)).size} categories`}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openAdd("camera")}>
              <Plus className="h-3.5 w-3.5" /> Add Equipment
            </Button>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {(["camera", "audio", "lighting", "support", "other"] as EquipmentCategory[]).map((cat) => (
          <EquipmentSection
            key={cat}
            category={cat}
            items={byCategory(cat)}
            canEdit={canEdit}
            onAdd={() => openAdd(cat)}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Empty overall state */}
      {totalItems === 0 && canEdit && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
          <Camera className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">No equipment added yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Add your camera package, audio gear, lighting, and support rigs.</p>
          <Button variant="gold" size="sm" className="mt-4" onClick={() => openAdd("camera")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add First Item
          </Button>
        </div>
      )}

      {/* Form dialog */}
      {dialogOpen && (
        <EquipmentForm
          projectId={projectId}
          initial={editingItem}
          defaultCategory={dialogCategory}
          onSave={handleSaved}
          onClose={() => { setDialogOpen(false); setEditingItem(null); }}
        />
      )}
    </>
  );
}
