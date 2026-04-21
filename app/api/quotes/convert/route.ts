import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    // Auth check — only the quote owner can convert
    const cookieStore = await cookies();
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { quoteId } = await req.json();
    if (!quoteId) return NextResponse.json({ error: "quoteId required" }, { status: 400 });

    const supabase = getAdminClient();

    // Fetch quote — must belong to the authenticated user
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("created_by", user.id)
      .single();

    if (qErr || !quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (quote.converted_project_id) {
      return NextResponse.json({ projectId: quote.converted_project_id, invoiceId: quote.converted_invoice_id });
    }

    // ── Create project ──────────────────────────────────────────────────────
    const projectType = quote.quote_type === "retainer" ? "commercial" : "commercial";
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .insert({
        title: quote.description || `${quote.client_name ?? "New"} Project`,
        description: quote.scope_of_work ?? null,
        client_name: quote.client_name ?? null,
        client_email: quote.client_email ?? null,
        status: "active",
        type: projectType,
        progress: 0,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Failed to create project: " + projErr?.message }, { status: 500 });
    }

    // ── Build invoice line items ─────────────────────────────────────────────
    let lineItems: { id: string; description: string; quantity: number; rate: number }[] = [];

    if (quote.quote_type === "retainer") {
      lineItems = [{
        id: crypto.randomUUID(),
        description: `Retainer — ${quote.client_name ?? "Monthly"} (${quote.retainer_months ?? 1} month${(quote.retainer_months ?? 1) !== 1 ? "s" : ""})`,
        quantity: quote.retainer_months ?? 1,
        rate: quote.monthly_rate ?? 0,
      }];
    } else if (quote.packages?.length) {
      // Find the highlighted package, or first
      const pkg = quote.packages.find((p: { highlighted?: boolean }) => p.highlighted) ?? quote.packages[0];
      lineItems = pkg?.line_items ?? [];
    } else {
      lineItems = quote.line_items ?? [];
    }

    // ── Create invoice ───────────────────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    // Auto-number invoice
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("created_by", user.id);
    const nums = (existingInvoices ?? [])
      .map((i: { invoice_number: string }) => parseInt(i.invoice_number.replace(/\D/g, ""), 10))
      .filter((n: number) => !isNaN(n));
    const nextNum = `INV-${String(nums.length ? Math.max(...nums) + 1 : 1).padStart(4, "0")}`;

    const invoiceAmount = quote.amount > 0
      ? quote.amount
      : lineItems.reduce((s: number, li: { quantity: number; rate: number }) => s + li.quantity * li.rate, 0);

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        project_id: project.id,
        invoice_number: nextNum,
        client_name: quote.client_name ?? null,
        client_email: quote.client_email ?? null,
        description: quote.description ?? null,
        amount: invoiceAmount,
        amount_paid: 0,
        status: "draft",
        invoice_date: today,
        due_date: dueDate,
        payment_terms: quote.payment_terms ?? "net30",
        tax_rate: quote.tax_rate ?? 0,
        line_items: lineItems,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (invErr) {
      // Non-fatal — project was created, invoice failed
      await supabase.from("quotes").update({ converted_project_id: project.id }).eq("id", quoteId);
      return NextResponse.json({ projectId: project.id, invoiceId: null, invoiceError: invErr.message });
    }

    // ── Mark quote as converted ──────────────────────────────────────────────
    await supabase
      .from("quotes")
      .update({
        converted_project_id: project.id,
        converted_invoice_id: invoice.id,
      })
      .eq("id", quoteId);

    return NextResponse.json({ projectId: project.id, invoiceId: invoice.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal error: " + msg }, { status: 500 });
  }
}
