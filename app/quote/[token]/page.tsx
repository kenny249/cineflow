import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import QuotePortalClient from "./QuotePortalClient";
import type { Quote } from "@/types";

// Server-side only, with the service role key — the token match below is
// the entire access check, so it must happen behind a key the browser never
// sees. The anon key this used to run under is public (shipped in every
// page), and the database's own policy for this table only checked
// is_active, not the token — meaning anyone with that key could ask for
// every active quote directly, no token needed at all. See the tightened
// RLS policy on `quotes` for the other half of this fix.
async function getQuote(token: string): Promise<Quote | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();
  if (error || !data) return null;
  return data as Quote;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getQuote(token);
  if (!quote) return { title: "Quote Not Found" };
  return {
    title: `Quote ${quote.quote_number}${quote.client_name ? ` · ${quote.client_name}` : ""}`,
    description: quote.description ?? "Review your project quote",
  };
}

export default async function QuotePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getQuote(token);
  if (!quote) notFound();
  return <QuotePortalClient quote={quote} />;
}
