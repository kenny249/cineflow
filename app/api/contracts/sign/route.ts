import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// GET /api/contracts/sign?token=xxx — fetch contract data for signing page
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const supabase = getAdmin();
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("id, title, description, file_url, status, recipient_name, recipient_email, signed_at")
    .eq("signing_token", token)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  return NextResponse.json({ contract });
}

// POST /api/contracts/sign?token=xxx — submit signature
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  let body: { signer_name: string; signer_email?: string; signature_data: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.signer_name?.trim()) {
    return NextResponse.json({ error: "Signer name is required" }, { status: 400 });
  }
  if (!body.signature_data?.trim()) {
    return NextResponse.json({ error: "Signature is required" }, { status: 400 });
  }

  const supabase = getAdmin();

  // Fetch contract by token
  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select("id, status")
    .eq("signing_token", token)
    .single();

  if (contractErr || !contract) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (contract.status === "signed") {
    return NextResponse.json({ error: "Contract has already been signed" }, { status: 409 });
  }

  if (contract.status === "voided") {
    return NextResponse.json({ error: "This contract has been voided" }, { status: 410 });
  }

  // Get IP from forwarded header
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Save signature
  const { error: sigErr } = await supabase.from("contract_signatures").insert({
    contract_id: contract.id,
    signer_name: body.signer_name.trim(),
    signer_email: body.signer_email?.trim() || null,
    signature_data: body.signature_data,
    ip_address: ip,
  });

  if (sigErr) {
    return NextResponse.json({ error: "Failed to save signature" }, { status: 500 });
  }

  // Mark contract as signed
  await supabase
    .from("contracts")
    .update({ status: "signed", signed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", contract.id);

  return NextResponse.json({ success: true });
}
