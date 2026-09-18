import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptPaymentCredentials, getPaymentCredentials, type PaymentCredentials } from "@/lib/payment-credentials";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Stripe/Resend keys are encrypted at rest — only server code holding
// CREDENTIALS_ENCRYPTION_KEY can decrypt them, so reads and writes have to
// go through here instead of the browser talking to payment_credentials directly.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creds = await getPaymentCredentials(supabase, user.id);
  return NextResponse.json(creds);
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as PaymentCredentials;
  const encrypted = encryptPaymentCredentials(body);

  const { error } = await supabase.from("payment_credentials").upsert(
    { user_id: user.id, ...encrypted, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
