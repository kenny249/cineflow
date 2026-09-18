import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "@/lib/credential-crypto";

export interface PaymentCredentials {
  stripe_secret_key?: string | null;
  stripe_webhook_secret?: string | null;
  resend_api_key?: string | null;
}

function decryptRow(row: PaymentCredentials | null | undefined): PaymentCredentials {
  if (!row) return {};
  return {
    stripe_secret_key: row.stripe_secret_key ? decryptSecret(row.stripe_secret_key) : null,
    stripe_webhook_secret: row.stripe_webhook_secret ? decryptSecret(row.stripe_webhook_secret) : null,
    resend_api_key: row.resend_api_key ? decryptSecret(row.resend_api_key) : null,
  };
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
  return decryptRow(data);
}

// Batch variant for jobs (e.g. the invoice-reminders cron) that need credentials
// for many owners in one query rather than one row at a time.
export async function getPaymentCredentialsBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userIds: string[]
): Promise<Record<string, PaymentCredentials>> {
  if (userIds.length === 0) return {};
  const { data } = await supabase
    .from("payment_credentials")
    .select("user_id, stripe_secret_key, stripe_webhook_secret, resend_api_key")
    .in("user_id", userIds);
  const out: Record<string, PaymentCredentials> = {};
  for (const row of data ?? []) {
    out[row.user_id as string] = decryptRow(row as PaymentCredentials);
  }
  return out;
}

export function encryptPaymentCredentials(creds: PaymentCredentials): PaymentCredentials {
  return {
    stripe_secret_key: creds.stripe_secret_key ? encryptSecret(creds.stripe_secret_key) : null,
    stripe_webhook_secret: creds.stripe_webhook_secret ? encryptSecret(creds.stripe_webhook_secret) : null,
    resend_api_key: creds.resend_api_key ? encryptSecret(creds.resend_api_key) : null,
  };
}
