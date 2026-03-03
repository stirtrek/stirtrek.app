import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Event, EventMembership } from "@/lib/types";

// Simple in-memory caches for event lookups
// Events change rarely, so a short TTL is fine
const eventCache = new Map<string, { event: Event; expiresAt: number }>();
const domainCache = new Map<string, { event: Event | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Resolve an event by its slug. Uses a short-lived in-memory cache.
 * Returns null if not found or inactive.
 */
export async function resolveEvent(slug: string): Promise<Event | null> {
  const cached = eventCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.event;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (data) {
    eventCache.set(slug, {
      event: data as Event,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return (data as Event) ?? null;
}

/**
 * Resolve an event by its custom domain (e.g. "stirtrek.app").
 * Uses a short-lived in-memory cache. Returns null if no event
 * is mapped to this domain.
 */
export async function resolveEventByDomain(
  hostname: string,
): Promise<Event | null> {
  // Strip port number if present (e.g. "localhost:3000")
  const domain = hostname.split(":")[0].toLowerCase();

  const cached = domainCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.event;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("*")
    .eq("domain", domain)
    .eq("is_active", true)
    .single();

  const event = (data as Event) ?? null;
  domainCache.set(domain, {
    event,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  // Also populate the slug cache if we found an event
  if (event) {
    eventCache.set(event.slug, {
      event,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return event;
}

/**
 * Check if the current authenticated user is an admin or staff member
 * for the given event. Returns the membership if authorized, null otherwise.
 */
export async function checkEventAdmin(
  eventId: string
): Promise<EventMembership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("event_memberships")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();

  if (
    !membership ||
    !["admin", "staff"].includes(membership.role)
  ) {
    return null;
  }

  return membership as EventMembership;
}

/**
 * Check if the current authenticated user is a member of the given event.
 * Returns the membership if found, null otherwise.
 */
export async function checkEventMembership(
  eventId: string
): Promise<EventMembership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("event_memberships")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();

  return (membership as EventMembership) ?? null;
}

/**
 * Get the authenticated user's ID, or null if not authenticated.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Resolve event from route params and check admin access.
 * Convenience wrapper for admin API routes.
 * Returns { event, membership } or null if unauthorized.
 */
export async function resolveEventAndCheckAdmin(
  eventSlug: string
): Promise<{ event: Event; membership: EventMembership } | null> {
  const event = await resolveEvent(eventSlug);
  if (!event) return null;

  const membership = await checkEventAdmin(event.id);
  if (!membership) return null;

  return { event, membership };
}
