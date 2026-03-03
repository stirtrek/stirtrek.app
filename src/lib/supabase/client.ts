import { createBrowserClient } from "@supabase/ssr";

/**
 * Create a browser-side Supabase client.
 * When eventId is provided, sets the x-event-id header so RLS policies
 * can enforce tenant isolation on direct Supabase queries.
 */
export function createClient(eventId?: string) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    ...(eventId
      ? [
          {
            global: {
              headers: {
                "x-event-id": eventId,
              },
            },
          },
        ]
      : [])
  );
}
