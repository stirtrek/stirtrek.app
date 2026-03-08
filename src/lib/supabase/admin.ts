import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Returns a singleton admin (service-role) Supabase client.
 * Safe to reuse because it carries no per-request state
 * (no cookies, no user session, no auth refresh).
 */
export function createAdminClient(): SupabaseClient {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set",
      );
    }
    cached = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cached;
}
