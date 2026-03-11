import { createBrowserClient } from "@supabase/ssr";

/**
 * Cache of event-scoped clients keyed by eventId.
 * All providers sharing the same eventId reuse one client instance,
 * avoiding multiple GoTrueClient instances fighting over the same
 * storage key.
 */
const eventClientCache = new Map<string, ReturnType<typeof createBrowserClient>>();

/**
 * Create a browser-side Supabase client.
 *
 * Without eventId: returns the @supabase/ssr singleton (used by AuthProvider).
 * With eventId: returns a cached, non-singleton client that carries the
 * x-event-id header for RLS tenant isolation. The client is shared across
 * all providers for the same eventId to prevent duplicate GoTrueClient
 * instances.
 */
export function createClient(eventId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (eventId) {
    const cached = eventClientCache.get(eventId);
    if (cached) return cached;

    const client = createBrowserClient(url, key, {
      isSingleton: false,
      global: {
        headers: {
          "x-event-id": eventId,
        },
      },
      auth: {
        // Let the global singleton (AuthProvider) handle token refresh.
        // Without this, the event-scoped client creates its own GoTrueClient
        // that fights over the same storage lock, causing INITIAL_SESSION
        // timeouts and auth failures.
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    eventClientCache.set(eventId, client);
    return client;
  }

  return createBrowserClient(url, key);
}
