import { notFound } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Invoice, Profile, PaymentSettings } from "@/types";
import { PayPage } from "./PayPage";

// ─── Server: fetch data ───────────────────────────────────────────────────────

async function getInvoiceData(invoiceId: string): Promise<{
  invoice: Invoice;
  biz: {
    name: string;
    email: string;
    phone: string;
    address: string;
    website: string;
    payment_method: string | undefined;
    payment_settings: Omit<PaymentSettings, "stripe_secret_key" | "resend_api_key">;
  };
} | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Use service role if available (bypasses RLS); otherwise use anon key with public read policy
  const supabase = serviceKey
    ? createServiceClient(supabaseUrl, serviceKey)
    : createServiceClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) return null;

  // Fetch only safe fields from creator's profile — never expose API keys
  // Only possible with service role key; skip gracefully without it
  const { data: profile } = serviceKey
    ? await supabase
        .from("profiles")
        .select("full_name, company, email, business_name, business_address, business_phone, business_website, payment_settings")
        .eq("id", invoice.created_by)
        .single()
    : { data: null };

  const p = profile as Profile | null;
  const ps = (p?.payment_settings ?? {}) as PaymentSettings;

  return {
    invoice: invoice as Invoice,
    biz: {
      name: p?.business_name || p?.company || p?.full_name || "Studio",
      email: p?.email ?? "",
      phone: p?.business_phone ?? "",
      address: p?.business_address ?? "",
      website: p?.business_website ?? "",
      payment_method: (invoice as Invoice).payment_method,
      payment_settings: {
        paypal_me_username: ps.paypal_me_username,
        zelle_contact: ps.zelle_contact,
        ach_bank_name: ps.ach_bank_name,
        ach_routing: ps.ach_routing,
        ach_account: ps.ach_account,
        wire_instructions: ps.wire_instructions,
        check_payable_to: ps.check_payable_to,
        check_mail_to: ps.check_mail_to,
        invoice_from_email: ps.invoice_from_email,
        invoice_from_name: ps.invoice_from_name,
      },
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const data = await getInvoiceData(invoiceId);
  if (!data) return { title: "Invoice Not Found" };
  return {
    title: `Invoice ${data.invoice.invoice_number} — ${data.biz.name}`,
    description: `Pay invoice ${data.invoice.invoice_number} from ${data.biz.name}`,
  };
}

export default async function PayInvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const data = await getInvoiceData(invoiceId);
  if (!data) notFound();

  return <PayPage invoice={data.invoice} biz={data.biz} />;
}
