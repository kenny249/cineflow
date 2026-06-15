import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentCredentials } from "@/lib/payment-credentials";

async function stripePost(
  path: string,
  body: Record<string, string>,
  secretKey: string
) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get workspace_id for ownership check and credentials in parallel
    const [{ data: profile }, creds] = await Promise.all([
      supabase.from("profiles").select("workspace_id").eq("id", user.id).single(),
      getPaymentCredentials(supabase, user.id),
    ]);

    const stripeKey = creds.stripe_secret_key;
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Stripe secret key not configured. Add it in Settings → Payment." },
        { status: 400 }
      );
    }

    // Scope invoice fetch to the user's workspace — defense in depth alongside RLS.
    const workspaceOwnerId = (profile as { workspace_id?: string } | null)?.workspace_id ?? user.id;
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("created_by", workspaceOwnerId)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const totalCents = Math.round((invoice.amount as number) * 100);
    if (totalCents <= 0) {
      return NextResponse.json(
        { error: "Invoice amount must be greater than 0" },
        { status: 400 }
      );
    }

    // 1. Create a Stripe Product for this invoice
    const product = await stripePost(
      "/products",
      {
        name: `Invoice ${invoice.invoice_number as string}`,
        ...(invoice.description
          ? { description: invoice.description as string }
          : {}),
      },
      stripeKey
    );
    if (product.error) {
      return NextResponse.json({ error: product.error.message }, { status: 400 });
    }

    // 2. Create a one-time Price
    const price = await stripePost(
      "/prices",
      {
        product: product.id as string,
        unit_amount: String(totalCents),
        currency: "usd",
      },
      stripeKey
    );
    if (price.error) {
      return NextResponse.json({ error: price.error.message }, { status: 400 });
    }

    // 3. Create a permanent Payment Link with redirect back to pay page after completion
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com";
    const link = await stripePost(
      "/payment_links",
      {
        "line_items[0][price]": price.id as string,
        "line_items[0][quantity]": "1",
        "after_completion[type]": "redirect",
        "after_completion[redirect][url]": `${baseUrl}/pay/${invoiceId}?session_id={CHECKOUT_SESSION_ID}`,
      },
      stripeKey
    );
    if (link.error) {
      return NextResponse.json({ error: link.error.message }, { status: 400 });
    }

    // 4. Save URL back to the invoice
    await supabase
      .from("invoices")
      .update({
        payment_link: link.url as string,
        payment_method: "stripe",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    return NextResponse.json({ url: link.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create payment link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
