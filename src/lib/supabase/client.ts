import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-captured reference to the auth singleton so event-scoped
 * clients can read its access token without creating their own
 * GoTrueClient.
 */
let _singleton: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Cache of event-scoped clients keyed by eventId.
 * All providers sharing the same eventId reuse one client instance.
 */
const eventClientCache = new Map<string, SupabaseClient>();

/**
 * Create a browser-side Supabase client.
 *
 * Without eventId: returns the @supabase/ssr singleton (used by AuthProvider).
 * With eventId: returns a cached client that carries the x-event-id header
 * for RLS tenant isolation. Event-scoped clients use the `accessToken`
 * option to piggyback on the singleton's auth session, which avoids
 * creating a second GoTrueClient and the navigator-lock contention that
 * causes "Multiple GoTrueClient instances" warnings and INITIAL_SESSION
 * timeouts.
 */
export function createClient(eventId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (!eventId) {
    if (!_singleton) {
      _singleton = createBrowserClient(url, key);
    }
    return _singleton;
  }

  const cached = eventClientCache.get(eventId);
  if (cached) return cached;

  const client = createSupabaseClient(url, key, {
    global: {
      headers: {
        "x-event-id": eventId,
      },
    },
    accessToken: async () => {
      if (!_singleton) return "";
      const { data } = await _singleton.auth.getSession();
      return data.session?.access_token ?? "";
    },
  });

  eventClientCache.set(eventId, client);
  return client;
}
