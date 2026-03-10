import { createBrowserClient } from "@supabase/ssr";

/**
 * Create a browser-side Supabase client.
 *
 * Without eventId: returns the @supabase/ssr singleton (used by AuthProvider).
 * With eventId: creates a separate, non-singleton client that carries the
 * x-event-id header for RLS tenant isolation. Consumers should cache the
 * result with useMemo to avoid re-creating on every render.
 */
export function createClient(eventId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (eventId) {
    return createBrowserClient(url, key, {
      isSingleton: false,
      auth: {
        // Prevent this client from creating its own GoTrueClient.
        // The singleton client (AuthProvider) owns the auth session;
        // extra GoTrueClient instances cause lock contention and
        // race conditions during sign-out.
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: true,
      },
      global: {
        headers: {
          "x-event-id": eventId,
        },
      },
    });
  }

  return createBrowserClient(url, key);
}
