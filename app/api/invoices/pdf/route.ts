import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require("@react-pdf/renderer");
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { InvoicePdfDocument } from "@/lib/invoice-pdf";
import type { Invoice, Profile } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("id");
  if (!invoiceId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: invoice, error: invErr }, { data: profile }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).single(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  if (invErr || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const doc = createElement(InvoicePdfDocument, {
    invoice: invoice as Invoice,
    profile: profile as Profile | null,
  });

  const buffer: Buffer = await renderToBuffer(doc);

  const slug = (invoice as Invoice).invoice_number
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}.pdf"`,
    },
  });
}
