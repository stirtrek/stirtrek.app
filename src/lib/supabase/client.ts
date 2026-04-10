import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Single browser-side Supabase client.
 *
 * One client handles both auth and tenant-scoped queries. The
 * `x-event-id` header is set globally per event so RLS policies
 * receive it on every PostgREST request. We cache one client per
 * event slug because users only operate on a single event at a time
 * during a browser session — this avoids the "Multiple GoTrueClient
 * instances" warning that comes from having parallel auth clients.
 */
const eventClientCache = new Map<string, SupabaseClient>();
let _noEventClient: SupabaseClient | null = null;

export function createClient(eventId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (!eventId) {
    if (!_noEventClient) {
      _noEventClient = createBrowserClient(url, key);
    }
    return _noEventClient;
  }

  const cached = eventClientCache.get(eventId);
  if (cached) return cached;

  const client = createBrowserClient(url, key, {
    global: {
      headers: {
        "x-event-id": eventId,
      },
    },
  });
  eventClientCache.set(eventId, client);
  return client;
}
