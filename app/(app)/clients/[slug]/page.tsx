"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, Globe, Edit2, Save, X, Loader2,
  FolderKanban, FileSignature, DollarSign, ClipboardList,
  ExternalLink, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getProjects, getClientContacts, upsertClientContact, getInvoices,
} from "@/lib/supabase/queries";
import type { ClientContact } from "@/lib/supabase/queries";
import type { Project, Invoice, Contract } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  active:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  review:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  delivered: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  archived:  "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", active: "In Production", review: "In Review",
  delivered: "Delivered", archived: "Archived",
};

const INV_COLOR: Record<string, string> = {
  draft:   "bg-zinc-500/10 text-zinc-400",
  sent:    "bg-blue-500/10 text-blue-400",
  partial: "bg-amber-500/10 text-amber-400",
  overdue: "bg-red-500/10 text-red-400",
  paid:    "bg-emerald-500/10 text-emerald-400",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientName = decodeURIComponent(params.slug as string);

  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contact, setContact] = useState<ClientContact | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ contact_name: "", email: "", phone: "", website: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const [projectsData, contactsData, invoicesData, { data: contractsData }] = await Promise.all([
        getProjects(),
        getClientContacts(),
        getInvoices(),
        supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      ]);

      const clientProjects = projectsData.filter(
        (p) => (p.client_name ?? "").toLowerCase() === clientName.toLowerCase()
      );
      const clientInvoices = invoicesData.filter(
        (inv) => (inv.client_name ?? "").toLowerCase() === clientName.toLowerCase()
      );
      const clientContracts = (contractsData ?? []).filter(
        (c: Contract) => (c.recipient_name ?? "").toLowerCase() === clientName.toLowerCase()
          || (c.recipient_email ?? "").toLowerCase() === (contactsData.find(
            (x) => x.client_name.toLowerCase() === clientName.toLowerCase()
          )?.email ?? "___").toLowerCase()
      );

      setProjects(clientProjects);
      setInvoices(clientInvoices);
      setContracts(clientContracts as Contract[]);

      const found = contactsData.find(
        (c) => c.client_name.toLowerCase() === clientName.toLowerCase()
      ) ?? null;
      setContact(found);
      if (found) {
        setEditForm({
          contact_name: found.contact_name ?? "",
          email: found.email ?? "",
          phone: found.phone ?? "",
          website: found.website ?? "",
          notes: found.notes ?? "",
        });
      }
    } catch {
      toast.error("Failed to load client data");
    } finally {
      setLoading(false);
    }
  }, [clientName]);

  useEffect(() => { load(); }, [load]);

  const openEdit = () => {
    setEditForm({
      contact_name: contact?.contact_name ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      website: contact?.website ?? "",
      notes: contact?.notes ?? "",
    });
    setEditing(true);
  };

  const saveContact = async () => {
    setSaving(true);
    try {
      const updated = await upsertClientContact(clientName, editForm);
      setContact(updated);
      setEditing(false);
      toast.success("Contact info saved");
    } catch {
      toast.error("Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  // Finance summary
  const totalInvoiced = invoices.filter((i) => i.status !== "draft").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue" || i.status === "partial")
    .reduce((s, i) => s + i.amount, 0);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <button
          onClick={() => router.push("/clients")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Clients
        </button>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="font-display text-lg font-bold text-foreground">{clientName}</h1>
        <div className="ml-auto flex items-center gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Edit2 className="h-3.5 w-3.5" />
              Edit Contact
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button variant="gold" size="sm" onClick={saveContact} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-3xl space-y-6 p-6">

          {/* Contact card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d4a853]/10 text-lg font-bold text-[#d4a853]">
                {clientName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-foreground">{clientName}</p>
                {contact?.contact_name && (
                  <p className="text-xs text-muted-foreground">{contact.contact_name}</p>
                )}
              </div>
            </div>

            {editing ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Contact name</Label>
                  <Input value={editForm.contact_name} onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))} placeholder="Jane Smith" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Website</Label>
                  <Input value={editForm.website} onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://company.com" className="h-8 text-sm" />
                </div>
                <div className="col-span-full space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this client…" className="h-8 text-sm" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {contact?.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {contact.email}
                  </a>
                )}
                {contact?.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {contact.phone}
                  </a>
                )}
                {contact?.website && (
                  <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Globe className="h-3.5 w-3.5 shrink-0" /> {contact.website}
                  </a>
                )}
                {contact?.notes && (
                  <p className="text-xs text-muted-foreground italic mt-2">{contact.notes}</p>
                )}
                {!contact?.email && !contact?.phone && !contact?.website && (
                  <p className="text-xs text-muted-foreground">No contact info yet. Click Edit Contact to add details.</p>
                )}
              </div>
            )}
          </div>

          {/* Finance summary */}
          {invoices.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Invoiced", value: fmt(totalInvoiced), icon: DollarSign, color: "text-foreground" },
                { label: "Total Paid",     value: fmt(totalPaid),     icon: CheckCircle2, color: "text-emerald-400" },
                { label: "Outstanding",    value: fmt(outstanding),   icon: outstanding > 0 ? AlertCircle : Clock, color: outstanding > 0 ? "text-amber-400" : "text-muted-foreground" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4">
                  <Icon className={cn("h-4 w-4 mb-1.5", color)} />
                  <p className={cn("text-lg font-bold font-display", color)}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Projects */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                Projects
                <span className="text-xs font-normal text-muted-foreground">{projects.length}</span>
              </h2>
              <Link href="/projects" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                View all <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
            {projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No projects for this client yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-border/80 hover:bg-muted/20 transition-all group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground group-hover:text-[#d4a853] transition-colors truncate">{p.title}</p>
                      {p.type && <p className="text-xs text-muted-foreground capitalize">{p.type.replace(/_/g, " ")}</p>}
                    </div>
                    <Badge className={cn("text-[10px] border shrink-0", STATUS_COLOR[p.status] ?? STATUS_COLOR.draft)}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                    <ExternalLink className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Invoices */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Invoices
                <span className="text-xs font-normal text-muted-foreground">{invoices.length}</span>
              </h2>
              <Link href="/finance" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                View all <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
            {invoices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No invoices for this client yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{inv.invoice_number}</p>
                      {inv.due_date && <p className="text-xs text-muted-foreground">Due {new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
                    </div>
                    <p className="text-sm font-semibold text-foreground shrink-0">{fmt(inv.amount)}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize shrink-0", INV_COLOR[inv.status] ?? INV_COLOR.draft)}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Contracts */}
          {contracts.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileSignature className="h-4 w-4 text-muted-foreground" />
                  Contracts
                  <span className="text-xs font-normal text-muted-foreground">{contracts.length}</span>
                </h2>
                <Link href="/contracts" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  View all <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </div>
              <div className="space-y-2">
                {contracts.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                      {c.sent_at && <p className="text-xs text-muted-foreground">Sent {new Date(c.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
                    </div>
                    <Badge className={cn("text-[10px] border shrink-0", c.signed_at ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20")}>
                      {c.signed_at ? "Signed" : "Awaiting signature"}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick links */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "New Invoice",  href: "/finance",   icon: DollarSign },
                { label: "New Contract", href: "/contracts", icon: FileSignature },
                { label: "Send a Form",  href: "/forms",     icon: ClipboardList },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground hover:border-[#d4a853]/30 hover:text-foreground transition-all"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
