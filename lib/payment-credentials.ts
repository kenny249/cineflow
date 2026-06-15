import type { SupabaseClient } from "@supabase/supabase-js";

export interface PaymentCredentials {
  stripe_secret_key?: string | null;
  stripe_webhook_secret?: string | null;
  resend_api_key?: string | null;
}

export async function getPaymentCredentials(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<PaymentCredentials> {
  const { data } = await supabase
    .from("payment_credentials")
    .select("stripe_secret_key, stripe_webhook_secret, resend_api_key")
    .eq("user_id", userId)
    .single();
  return data ?? {};
}
