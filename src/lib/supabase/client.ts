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
  if (eventId) {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        isSingleton: false,
        global: {
          headers: {
            "x-event-id": eventId,
          },
        },
      }
    );
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
