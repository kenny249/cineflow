import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const supabase = getAdmin();

  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select("id, title, description, status, recipient_name, recipient_email, signed_at")
    .eq("signing_token", token)
    .single();

  if (contractErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status !== "signed") {
    return NextResponse.json({ error: "This contract has not been signed yet" }, { status: 400 });
  }

  const { data: signature } = await supabase
    .from("contract_signatures")
    .select("signer_name, signer_email, signature_data, signed_at, ip_address")
    .eq("contract_id", contract.id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ contract, signature: signature ?? null });
}
