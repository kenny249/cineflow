"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Sparkles, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BoardCard, CardType } from "@/lib/boards";
import { updateCard } from "@/lib/boards";
import { CARD_COLORS, CARD_TYPE_ICONS } from "./BoardCard";

type AIAction = "expand" | "rewrite" | "screenplay" | "variations" | "shot_notes";

const AI_ACTIONS: { key: AIAction; label: string; types: CardType[] }[] = [
  { key: "expand",     label: "Expand",       types: ["note", "script", "shot"] },
  { key: "rewrite",    label: "Rewrite",      types: ["note", "script"] },
  { key: "screenplay", label: "Screenplay",   types: ["script"] },
  { key: "variations", label: "Variations",   types: ["note", "script"] },
  { key: "shot_notes", label: "Shot Notes",   types: ["shot"] },
];

interface CardEditModalProps {
  card: BoardCard | null;
  onClose: () => void;
  onSaved: (card: BoardCard) => void;
}

export function CardEditModal({ card, onClose, onSaved }: CardEditModalProps) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  useEffect(() => {
    if (card) {
      setForm({ ...card.content });
      setColor(card.color ?? null);
      setAiResult(null);
    }
  }, [card]);

  if (!card) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await updateCard(card!.id, { content: form, color });
      onSaved({ ...card!, content: form, color });
      toast.success("Card saved");
      onClose();
    } catch {
      toast.error("Failed to save card");
    } finally {
      setSaving(false);
    }
  }

  async function handleAI(action: AIAction) {
    const text = getTextForAI(card!.type, form);
    if (!text) { toast.error("No text to enhance"); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai/board-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, action }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAiResult(json.result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "AI error");
    } finally {
      setAiLoading(false);
    }
  }

  function applyAIResult() {
    if (!aiResult) return;
    setForm((f) => applyTextToForm(card!.type, f, aiResult));
    setAiResult(null);
    toast.success("Applied AI result");
  }

  const availableAI = AI_ACTIONS.filter((a) => a.types.includes(card.type));

  return (
    <Dialog open={!!card} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-muted-foreground">{CARD_TYPE_ICONS[card.type]}</span>
            Edit {card.type.charAt(0).toUpperCase() + card.type.slice(1)} Card
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card color */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Color</Label>
            <div className="flex gap-1.5">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.label}
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  className={`h-5 w-5 rounded-full border-2 transition-all ${c.bg} ${color === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                />
              ))}
            </div>
          </div>

          {/* Fields per card type */}
          <FormFields card={card} form={form} setForm={setForm} />

          {/* AI Tools */}
          {availableAI.length > 0 && (
            <div className="rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/[0.03] p-3 space-y-2">
              <p className="text-xs font-medium text-[#d4a853] flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> AI Enhance
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableAI.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => handleAI(a.key)}
                    disabled={aiLoading}
                    className="rounded-lg border border-[#d4a853]/30 px-2.5 py-1 text-xs text-[#d4a853] hover:bg-[#d4a853]/10 disabled:opacity-40 transition-colors"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {aiLoading && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                </div>
              )}
              {aiResult && (
                <div className="space-y-2">
                  <div className="rounded-lg border border-border bg-background p-2.5 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {aiResult}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={applyAIResult}
                      className="flex items-center gap-1 rounded-lg bg-[#d4a853] px-3 py-1 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
                    >
                      <Check className="h-3 w-3" /> Apply
                    </button>
                    <button onClick={() => setAiResult(null)} className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors">
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="gold" size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Per-type form fields ──────────────────────────────────────────────────────

function FormFields({
  card,
  form,
  setForm,
}: {
  card: BoardCard;
  form: Record<string, unknown>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  function f(key: string): string {
    return (form[key] as string) ?? "";
  }
  function set(key: string, val: unknown) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  if (card.type === "note") return (
    <div className="space-y-3">
      <Field label="Title (optional)">
        <Input value={f("title")} onChange={(e) => set("title", e.target.value)} placeholder="Card title…" />
      </Field>
      <Field label="Text">
        <Textarea value={f("text")} onChange={(e) => set("text", e.target.value)} rows={6} placeholder="Write your note…" />
      </Field>
    </div>
  );

  if (card.type === "script") return (
    <div className="space-y-3">
      <Field label="Title (optional)">
        <Input value={f("title")} onChange={(e) => set("title", e.target.value)} placeholder="Scene or script title…" />
      </Field>
      <Field label="Script Content">
        <Textarea value={f("content")} onChange={(e) => set("content", e.target.value)} rows={8} placeholder="Script content…" className="font-mono text-xs" />
      </Field>
    </div>
  );

  if (card.type === "shot") return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Scene Type">
          <select
            value={f("scene_type")}
            onChange={(e) => set("scene_type", e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
          >
            <option value="">Select…</option>
            {["INT", "EXT", "INT/EXT", "EXT/INT"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Time">
          <select
            value={f("time")}
            onChange={(e) => set("time", e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
          >
            <option value="">Select…</option>
            {["DAY", "NIGHT", "DAWN", "DUSK", "MAGIC HOUR", "CONTINUOUS"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Location">
        <Input value={f("location")} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Kitchen — Studio B" />
      </Field>
      <Field label="Camera Angle">
        <Input value={f("camera_angle")} onChange={(e) => set("camera_angle", e.target.value)} placeholder="e.g. Wide, Eye Level, Dutch Angle…" />
      </Field>
      <Field label="Notes">
        <Textarea value={f("notes")} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Shot notes for the cinematographer…" />
      </Field>
    </div>
  );

  if (card.type === "image") return (
    <div className="space-y-3">
      <Field label="Image URL">
        <Input value={f("url")} onChange={(e) => set("url", e.target.value)} placeholder="https://…" type="url" />
      </Field>
      <Field label="Caption">
        <Input value={f("caption")} onChange={(e) => set("caption", e.target.value)} placeholder="Image caption…" />
      </Field>
    </div>
  );

  if (card.type === "video") return (
    <div className="space-y-3">
      <Field label="Video URL">
        <Input value={f("url")} onChange={(e) => set("url", e.target.value)} placeholder="https://…" type="url" />
      </Field>
      <Field label="Title (optional)">
        <Input value={f("title")} onChange={(e) => set("title", e.target.value)} placeholder="Video title…" />
      </Field>
      <Field label="Notes">
        <Textarea value={f("notes")} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Notes…" />
      </Field>
    </div>
  );

  if (card.type === "checklist") {
    const items = (form.items as { text: string; done: boolean }[]) ?? [];
    function addItem() {
      set("items", [...items, { text: "", done: false }]);
    }
    function removeItem(i: number) {
      set("items", items.filter((_, idx) => idx !== i));
    }
    function updateItem(i: number, text: string) {
      const next = [...items];
      next[i] = { ...next[i], text };
      set("items", next);
    }
    return (
      <div className="space-y-3">
        <Field label="Title (optional)">
          <Input value={f("title")} onChange={(e) => set("title", e.target.value)} placeholder="Checklist title…" />
        </Field>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Items</Label>
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={item.text}
                  onChange={(e) => updateItem(i, e.target.value)}
                  placeholder={`Item ${i + 1}…`}
                  className="flex-1"
                />
                <button onClick={() => removeItem(i)} className="text-muted-foreground/40 hover:text-red-400 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addItem}
            className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add item
          </button>
        </div>
      </div>
    );
  }

  if (card.type === "link") return (
    <div className="space-y-3">
      <Field label="URL">
        <Input value={f("url")} onChange={(e) => set("url", e.target.value)} placeholder="https://…" type="url" />
      </Field>
      <Field label="Title">
        <Input value={f("title")} onChange={(e) => set("title", e.target.value)} placeholder="Link title…" />
      </Field>
      <Field label="Description">
        <Textarea value={f("description")} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Brief description…" />
      </Field>
    </div>
  );

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

// ─── AI text helpers ──────────────────────────────────────────────────────────

function getTextForAI(type: CardType, form: Record<string, unknown>): string {
  if (type === "note")   return [form.title, form.text].filter(Boolean).join("\n\n") as string;
  if (type === "script") return [form.title, form.content].filter(Boolean).join("\n\n") as string;
  if (type === "shot")   return [form.scene_type, form.location, form.time, form.camera_angle, form.notes].filter(Boolean).join(" — ") as string;
  return "";
}

function applyTextToForm(type: CardType, form: Record<string, unknown>, text: string): Record<string, unknown> {
  if (type === "note")   return { ...form, text };
  if (type === "script") return { ...form, content: text };
  if (type === "shot")   return { ...form, notes: text };
  return form;
}
