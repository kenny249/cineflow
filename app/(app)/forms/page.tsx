"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Link2, Trash2, ChevronDown, ChevronRight,
  ClipboardList, CheckCircle2, XCircle, Loader2, Eye,
  User, Mail, Calendar, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import type { CineForm, FormResponse, FormQuestion } from "@/types";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://usecineflow.com";

// ── Response detail ───────────────────────────────────────────────────────────

function ResponseCard({
  response,
  questions,
}: {
  response: FormResponse;
  questions: FormQuestion[];
}) {
  const [expanded, setExpanded] = useState(false);
  const qMap = Object.fromEntries(questions.map((q) => [q.id, q]));
  const answered = Object.entries(response.answers).filter(([, v]) =>
    Array.isArray(v) ? v.length > 0 : v?.toString().trim() !== ""
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {response.respondent_name || "Anonymous"}
            </p>
            {response.respondent_email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> {response.respondent_email}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(response.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {answered.map(([qId, val]) => {
            const q = qMap[qId];
            if (!q) return null;
            const display = Array.isArray(val) ? val.join(", ") : val;
            return (
              <div key={qId} className="px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">{q.question}</p>
                <p className="text-sm text-foreground">{display}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Form row ──────────────────────────────────────────────────────────────────

function FormRow({
  form,
  onDelete,
}: {
  form: CineForm & { _responseCount?: number };
  onDelete: (id: string) => void;
}) {
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [responses, setResponses] = useState<FormResponse[] | null>(null);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const formUrl = `${APP_URL}/forms/${form.token}`;
  const responseCount = form._responseCount ?? 0;

  const loadResponses = async () => {
    if (responses !== null) { setResponsesOpen(true); return; }
    setLoadingResponses(true);
    try {
      const res = await fetch(`/api/forms/responses?form_id=${form.id}`);
      const json = await res.json();
      setResponses(json.responses ?? []);
      setResponsesOpen(true);
    } catch {
      toast.error("Failed to load responses");
    } finally {
      setLoadingResponses(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(formUrl);
    toast.success("Link copied!");
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-foreground">{form.title}</p>
                <Badge variant={form.status === "active" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                  {form.status === "active" ? "Active" : "Closed"}
                </Badge>
              </div>
              {form.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{form.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                Created {new Date(form.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {" · "}{form.questions.length} questions
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={loadResponses}
              disabled={loadingResponses}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {loadingResponses ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
              <span>{responseCount} {responseCount === 1 ? "response" : "responses"}</span>
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Link2 className="h-3 w-3" />
              <span className="hidden sm:inline">Copy link</span>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center justify-center rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        navigator.clipboard.writeText(formUrl);
                        toast.success("Link copied!");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> Copy link
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); window.open(formUrl, "_blank"); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" /> Preview form
                    </button>
                    <div className="border-t border-border" />
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onDelete(form.id); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete form
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Responses slide-down */}
      {responsesOpen && responses !== null && (
        <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Responses — {form.title}</p>
            <button
              type="button"
              onClick={() => setResponsesOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {responses.length === 0 ? (
              <div className="py-8 text-center">
                <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No responses yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Share your form link to start collecting</p>
              </div>
            ) : (
              responses.map((r) => (
                <ResponseCard key={r.id} response={r} questions={form.questions} />
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FormsPage() {
  const [forms, setForms] = useState<(CineForm & { _responseCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadForms = useCallback(async () => {
    try {
      const [formsRes, responsesRes] = await Promise.all([
        fetch("/api/forms"),
        fetch("/api/forms/responses?form_id=all").catch(() => ({ ok: false, json: async () => ({}) })),
      ]);
      const { forms: data } = await formsRes.json();
      // Count responses per form
      const allForms = data ?? [];
      // Load response counts individually for each form
      const withCounts = await Promise.all(
        allForms.map(async (f: CineForm) => {
          try {
            const r = await fetch(`/api/forms/responses?form_id=${f.id}`);
            const j = await r.json();
            return { ...f, _responseCount: (j.responses ?? []).length };
          } catch {
            return { ...f, _responseCount: 0 };
          }
        })
      );
      void responsesRes;
      setForms(withCounts);
    } catch {
      toast.error("Failed to load forms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadForms(); }, [loadForms]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "production_intake" }),
      });
      const { form, error } = await res.json();
      if (error) { toast.error(error); return; }
      setForms((prev) => [{ ...form, _responseCount: 0 }, ...prev]);
      toast.success("Form created! Copy the link and send it to your client.");
    } catch {
      toast.error("Failed to create form");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await fetch(`/api/forms?id=${deleteTargetId}`, { method: "DELETE" });
      setForms((prev) => prev.filter((f) => f.id !== deleteTargetId));
      toast.success("Form deleted");
    } catch {
      toast.error("Failed to delete form");
    } finally {
      setDeleting(false);
      setDeleteTargetId(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Forms</h1>
          <p className="text-xs text-muted-foreground">Send intake questionnaires to clients before quoting a project</p>
        </div>
        <Button variant="gold" size="sm" onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Form
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-2xl space-y-3 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : forms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-foreground">No forms yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a Production Intake form to send to your next client</p>
              <Button variant="gold" size="sm" className="mt-4" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Production Intake
              </Button>
            </div>
          ) : (
            <>
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[
                  { label: "Total forms",     value: forms.length,                                icon: ClipboardList },
                  { label: "Active",          value: forms.filter((f) => f.status === "active").length, icon: CheckCircle2 },
                  { label: "Total responses", value: forms.reduce((s, f) => s + (f._responseCount ?? 0), 0), icon: User },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-border bg-card p-4">
                    <Icon className="h-4 w-4 text-muted-foreground mb-1.5" />
                    <p className="text-xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {forms.map((form) => (
                <FormRow key={form.id} form={form} onDelete={setDeleteTargetId} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <Dialog open={!!deleteTargetId} onOpenChange={(v) => { if (!v) setDeleteTargetId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete form?</DialogTitle>
            <DialogDescription>This will permanently delete the form and all its responses. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTargetId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
