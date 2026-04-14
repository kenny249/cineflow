"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ChevronDown, ChevronRight, Briefcase, Search, Film, CheckCircle2, Clock, ArrowRight, X, Phone, Mail, Globe, UserCircle2, Edit2, FileSignature, ExternalLink } from "lucide-react";
import { getProjects, createProject, getClientContacts, upsertClientContact } from "@/lib/supabase/queries";
import type { ClientContact as DBClientContact } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, PROJECT_TYPE_LABELS } from "@/lib/utils";
import { toast } from "sonner";
import type { Project, Contract } from "@/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "In Production",
  review: "In Review",
  delivered: "Delivered",
  archived: "Archived",
};

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  active:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  review:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  delivered: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  archived:  "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

function groupByClient(projects: Project[]) {
  const map = new Map<string, Project[]>();
  for (const p of projects) {
    const key = p.client_name?.trim() || "Unassigned";
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });
}

const EMPTY_FORM = { title: "", client_name: "", type: "commercial" as const, description: "" };

interface ClientContact { email: string; phone: string; website: string; contact_name: string; notes: string; }
const EMPTY_CONTACT: ClientContact = { email: "", phone: "", website: "", contact_name: "", notes: "" };

export default function ClientsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Contracts (correlated by recipient_email)
  const [contracts, setContracts] = useState<Contract[]>([]);

  // Client contact info (DB-backed)
  const [clientContacts, setClientContacts] = useState<Record<string, ClientContact>>({});
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<ClientContact>(EMPTY_CONTACT);
  const [savingContact, setSavingContact] = useState(false);

  async function saveContact() {
    if (!editingContact) return;
    setSavingContact(true);
    try {
      await upsertClientContact(editingContact, contactForm);
      setClientContacts((prev) => ({ ...prev, [editingContact]: contactForm }));
      setEditingContact(null);
      toast.success("Contact info saved");
    } catch {
      toast.error("Failed to save contact");
    } finally {
      setSavingContact(false);
    }
  }

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    Promise.all([
      getProjects(),
      getClientContacts(),
      supabase.from("contracts").select("id, title, status, recipient_name, recipient_email, signing_token, signed_at, sent_at, created_at").order("created_at", { ascending: false }),
    ])
      .then(([projs, contacts, { data: contractRows }]) => {
        if (!alive) return;
        setProjects(projs);
        setContracts((contractRows as Contract[]) ?? []);
        const map: Record<string, ClientContact> = {};
        for (const c of contacts as DBClientContact[]) {
          map[c.client_name] = {
            contact_name: c.contact_name ?? "",
            email: c.email ?? "",
            phone: c.phone ?? "",
            website: c.website ?? "",
            notes: c.notes ?? "",
          };
        }
        setClientContacts(map);
      })
      .catch(() => toast.error("Failed to load clients"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.client_name?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const groups = useMemo(() => groupByClient(filtered), [filtered]);

  // Summary stats
  const totalClients = useMemo(
    () => new Set(projects.map((p) => p.client_name?.trim() || "Unassigned")).size,
    [projects]
  );
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const deliveredProjects = projects.filter((p) => p.status === "delivered").length;

  function toggle(key: string) {
    setExpandedClients((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function expandAll() {
    const all: Record<string, boolean> = {};
    groups.forEach(([k]) => { all[k] = true; });
    setExpandedClients(all);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.client_name.trim()) {
      toast.error("Client name and project title are required");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const created = await createProject({
        title: form.title.trim(),
        client_name: form.client_name.trim(),
        status: "draft",
        type: form.type,
        description: form.description.trim() || undefined,
        progress: 0,
        tags: [],
        created_by: user?.id,
        shoot_date: undefined,
        thumbnail_url: undefined,
        due_date: undefined,
      });
      setProjects((prev) => [created, ...prev]);
      // Auto-expand the new client's folder
      setExpandedClients((prev) => ({ ...prev, [form.client_name.trim()]: true }));
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast.success(`Project "${created.title}" created`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Briefcase className="h-4 w-4 text-[#d4a853]" />
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Clients</h1>
        </div>
        <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          New Project
        </Button>
      </div>

      {/* Stats bar */}
      <div className="shrink-0 grid grid-cols-3 divide-x divide-border border-b border-border">
        {[
          { label: "Clients",    value: totalClients },
          { label: "Active",     value: activeProjects },
          { label: "Delivered",  value: deliveredProjects },
        ].map(({ label, value }) => (
          <div key={label} className="px-5 py-3 text-center">
            <p className="font-display text-lg font-bold text-foreground">{value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* New project form */}
      {showForm && (
        <div className="shrink-0 border-b border-border bg-card/60 px-5 py-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Project</p>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Client name *</label>
                <input
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  placeholder="e.g. Volta EV"
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Project title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Launch campaign"
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                >
                  {(["commercial","documentary","music_video","short_film","corporate","wedding","event","other"] as const).map((t) => (
                    <option key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional brief"
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-60"
              >
                {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : null}
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + expand all */}
      <div className="shrink-0 flex items-center gap-3 border-b border-border px-5 py-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients or projects…"
            className="w-full rounded-lg border border-border bg-muted/30 py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none"
          />
        </div>
        {groups.length > 0 && (
          <button onClick={expandAll} className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Expand all
          </button>
        )}
      </div>

      {/* Client list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <Film className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-semibold text-foreground">No clients yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">Create your first project and assign a client name, it will appear here automatically.</p>
            <Button variant="gold" size="sm" className="mt-2" onClick={() => setShowForm(true)}>+ New Project</Button>
          </div>
        )}

        {groups.map(([clientName, clientProjects]) => {
          const isOpen = !!expandedClients[clientName];
          const activeCount = clientProjects.filter((p) => p.status === "active").length;
          const totalProgress = Math.round(
            clientProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / clientProjects.length
          );

          return (
            <div key={clientName} className="overflow-hidden rounded-xl border border-border bg-card/50">
              {/* Client row */}
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-card transition-colors"
                onClick={() => toggle(clientName)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#d4a853]/10 text-[#d4a853]">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{clientName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {clientProjects.length} project{clientProjects.length !== 1 ? "s" : ""}
                    {activeCount > 0 && <span className="ml-2 text-emerald-400">· {activeCount} active</span>}
                  </p>
                  {/* Contact info quick summary */}
                  {clientContacts[clientName] && (clientContacts[clientName].email || clientContacts[clientName].phone) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                      {clientContacts[clientName].contact_name && <span>{clientContacts[clientName].contact_name}</span>}
                      {clientContacts[clientName].phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{clientContacts[clientName].phone}</span>}
                      {clientContacts[clientName].email && <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{clientContacts[clientName].email}</span>}
                    </p>
                  )}
                </div>
                {/* Progress pill */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <div className="w-20 h-1 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-[#d4a853]" style={{ width: `${totalProgress}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{totalProgress}%</span>
                </div>
                {/* Edit contact */}
                <button
                  type="button"
                  title="Edit contact info"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContactForm(clientContacts[clientName] ?? EMPTY_CONTACT);
                    setEditingContact(clientName);
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                {/* Add project to this client */}
                <button
                  type="button"
                  title="Add project for this client"
                  onClick={(e) => {
                    e.stopPropagation();
                    setForm({ ...EMPTY_FORM, client_name: clientName === "Unassigned" ? "" : clientName });
                    setShowForm(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-[#d4a853]/10 hover:text-[#d4a853] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>

              {/* Project rows + Contracts */}
              {isOpen && (() => {
                const contact = clientContacts[clientName];
                const clientContracts = contact?.email
                  ? contracts.filter((c) => c.recipient_email?.toLowerCase() === contact.email.toLowerCase())
                  : [];
                return (
                <div className="border-t border-border divide-y divide-border">
                  {clientContracts.length > 0 && (
                    <div className="px-4 py-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Contracts</p>
                      {clientContracts.map((contract) => (
                        <div key={contract.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-2.5">
                          <FileSignature className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-foreground">{contract.title}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {contract.status === "signed" && contract.signed_at
                                ? `Signed ${new Date(contract.signed_at).toLocaleDateString()}`
                                : contract.status === "sent" && contract.sent_at
                                ? `Sent ${new Date(contract.sent_at).toLocaleDateString()}`
                                : "Draft"}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            contract.status === "signed"   ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" :
                            contract.status === "sent"     ? "border-amber-500/20 bg-amber-500/10 text-amber-400" :
                            contract.status === "declined" ? "border-red-500/20 bg-red-500/10 text-red-400" :
                            "border-border bg-muted/40 text-muted-foreground"
                          }`}>
                            {contract.status === "signed" ? "Signed" : contract.status === "sent" ? "Sent" : contract.status === "declined" ? "Declined" : "Draft"}
                          </span>
                          {contract.status === "signed" && contract.signing_token && (
                            <a
                              href={`/sign/${contract.signing_token}/certificate`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              title="View signed certificate"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {clientProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground group-hover:text-[#d4a853] transition-colors">{project.title}</p>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[project.status] ?? STATUS_COLOR.draft}`}>
                            {STATUS_LABEL[project.status] ?? project.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>{PROJECT_TYPE_LABELS[project.type]}</span>
                          {project.shoot_date && (
                            <><span>·</span><span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{formatDate(project.shoot_date, "MMM d, yyyy")}</span></>
                          )}
                          {!project.shoot_date && project.due_date && (
                            <><span>·</span><span>Due {formatDate(project.due_date, "MMM d")}</span></>
                          )}
                        </div>
                      </div>
                      {/* Mini progress bar */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${project.progress ?? 0}%`,
                              background: project.status === "delivered" ? "#34d399" : "#d4a853",
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right">{project.progress ?? 0}%</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                    </Link>
                  ))}
                </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* ── Client contact modal ── */}
      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingContact(null)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display font-semibold text-foreground">Contact: {editingContact}</h2>
              <button onClick={() => setEditingContact(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { label: "Primary Contact", key: "contact_name" as const, icon: UserCircle2, placeholder: "e.g. Jane Smith" },
                { label: "Email", key: "email" as const, icon: Mail, placeholder: "client@company.com", type: "email" },
                { label: "Phone", key: "phone" as const, icon: Phone, placeholder: "+1 (555) 000-0000", type: "tel" },
                { label: "Website", key: "website" as const, icon: Globe, placeholder: "https://company.com", type: "url" },
              ].map(({ label, key, icon: Icon, placeholder, type }) => (
                <div key={key}>
                  <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><Icon className="h-3 w-3" />{label}</label>
                  <input
                    type={type ?? "text"}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                    placeholder={placeholder}
                    value={contactForm[key]}
                    onChange={(e) => setContactForm((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Notes</label>
                <textarea
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                  placeholder="Billing address, preferred contact hours…"
                  value={contactForm.notes}
                  onChange={(e) => setContactForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => setEditingContact(null)} className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted/20">Cancel</button>
              <button onClick={saveContact} disabled={savingContact} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-60">
                {savingContact && <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
