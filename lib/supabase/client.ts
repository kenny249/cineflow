import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Implicit flow: Supabase returns tokens in the URL hash instead of
          // a PKCE code. This is required for magic links because PKCE stores
          // the verifier in the browser that submitted the form — which is
          // never available when a user opens the link from their email app.
          flowType: "implicit",
        },
      }
    );
  }
  return _client;
}
