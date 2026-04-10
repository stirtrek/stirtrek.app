import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { Profile } from "@/lib/types";

export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const eventId = headerStore.get("x-event-id");

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
      // Forward event ID to PostgREST so RLS policies can read it
      ...(eventId && {
        global: {
          headers: {
            "x-event-id": eventId,
          },
        },
      }),
    }
  );
}

/**
 * Cached auth user lookup. Deduplicates `auth.getUser()` calls within
 * a single server request (layout + page + nested components).
 * React's `cache()` scopes to the current request lifecycle.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Cached lookup that returns the auth user plus their profile row.
 * Used by the [eventSlug] layout to hydrate the client AuthProvider
 * with everything needed up front — no client-side fetching.
 */
export const getAuthUserAndProfile = cache(async (): Promise<{
  user: Awaited<ReturnType<typeof getAuthUser>>;
  profile: Profile | null;
}> => {
  const user = await getAuthUser();
  if (!user) return { user: null, profile: null };

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile: profile ?? null };
});
