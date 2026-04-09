import { createClient as createBrowserClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Please set both in .env.local and restart the Next.js server."
  );
}

// Create a singleton client instance
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Export the singleton instance
export { supabase };

// Also export a function that returns the singleton for consistency
export function createClient() {
  return supabase;
}
