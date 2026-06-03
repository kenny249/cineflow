import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { ReportClient } from "./ReportClient";

async function getData(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: trip } = await supabase
    .from("wrap_trips")
    .select("*")
    .eq("id", id)
    .single();

  if (!trip) return null;

  const { data: receipts } = await supabase
    .from("wrap_receipts")
    .select("*")
    .eq("trip_id", id)
    .order("date", { ascending: true });

  return { trip, receipts: receipts ?? [] };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  return <ReportClient trip={data.trip} receipts={data.receipts} />;
}
