import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import QuotePortalClient from "./QuotePortalClient";
import type { Quote } from "@/types";

// Server-side anon fetch — quotes have a public SELECT policy for is_active=true
async function getQuote(token: string): Promise<Quote | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
