import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, EventFeatureFlags, EventMembership } from "@/lib/types";

// Simple in-memory cache for event lookups
const eventCacheById = new Map<string, { event: Event; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Look up an event by ID with caching.
 */
export async function getEventById(eventId: string): Promise<Event | null> {
  const cached = eventCacheById.get(eventId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.event;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("is_active", true)
    .single();

  if (data) {
    eventCacheById.set(eventId, {
      event: data as Event,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return (data as Event) ?? null;
}

/**
 * Get the event ID from request headers.
 * The middleware resolves the event from the URL slug and sets
 * the x-event-id header on every request under [eventSlug]/.
 * Throws if the header is missing (should never happen in normal flow).
 */
export function getEventId(request: Request): string {
  const headerVal = request.headers.get("x-event-id");
  if (!headerVal) {
    throw new Error("Missing x-event-id header. Ensure middleware is resolving the event.");
  }
  return headerVal;
}

/**
 * Check that a feature flag is enabled for the given event.
 * Returns null if the feature is enabled, or a 404 NextResponse if disabled.
 */
export async function requireFeatureFlag(
  eventId: string,
  feature: keyof EventFeatureFlags,
): Promise<NextResponse | null> {
  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const flags = event.feature_flags ?? ({} as EventFeatureFlags);
  if (!flags[feature]) {
    return NextResponse.json(
      { error: "Feature not available" },
      { status: 404 },
    );
  }

  return null; // Feature is enabled
}

/**
 * Check that the current user is authenticated and is an admin/staff
 * member for the given event. Returns the user ID and membership, or
 * an error response.
 */
export async function requireEventAdmin(
  eventId: string,
): Promise<
  | { userId: string; membership: EventMembership; event: Event }
  | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("event_memberships")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();

  if (membership && ["admin", "staff"].includes(membership.role)) {
    return { userId: user.id, membership: membership as EventMembership, event };
  }

  // Super admins have admin access to every event
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_super_admin) {
    const syntheticMembership: EventMembership = {
      id: `super-admin-${user.id}`,
      event_id: eventId,
      user_id: user.id,
      role: "admin",
      is_sponsor: false,
      sponsor_id: null,
      joined_at: new Date().toISOString(),
    };
    return { userId: user.id, membership: syntheticMembership, event };
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Stricter check: requires admin role (not staff).
 */
export async function requireEventAdminOnly(
  eventId: string,
): Promise<
  | { userId: string; membership: EventMembership; event: Event }
  | NextResponse
> {
  const result = await requireEventAdmin(eventId);
  if (result instanceof NextResponse) return result;

  if (result.membership.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return result;
}

/**
 * Check that the current user is authenticated and is a member of the event.
 * Returns user ID and membership or an error response.
 */
export async function requireEventMember(
  eventId: string,
): Promise<
  | { userId: string; membership: EventMembership; event: Event }
  | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("event_memberships")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this event" }, { status: 403 });
  }

  return { userId: user.id, membership: membership as EventMembership, event };
}

/**
 * Check that the current user is authenticated. No event membership required.
 * Returns the user ID or an error response.
 */
export async function requireAuth(): Promise<
  { userId: string } | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId: user.id };
}

/**
 * Check that the current user is a super-admin.
 * Returns the user ID or an error response.
 */
export async function requireSuperAdmin(): Promise<
  { userId: string } | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id };
}

/**
 * Check that the current user is authenticated and is an admin, staff,
 * or proctor member for the given event. Returns the user ID and
 * membership, or an error response.
 */
export async function requireEventProctor(
  eventId: string,
): Promise<
  | { userId: string; membership: EventMembership; event: Event }
  | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("event_memberships")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();

  if (membership && ["admin", "staff", "proctor"].includes(membership.role)) {
    return { userId: user.id, membership: membership as EventMembership, event };
  }

  // Super admins have access to everything
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_super_admin) {
    const syntheticMembership: EventMembership = {
      id: `super-admin-${user.id}`,
      event_id: eventId,
      user_id: user.id,
      role: "admin",
      is_sponsor: false,
      sponsor_id: null,
      joined_at: new Date().toISOString(),
    };
    return { userId: user.id, membership: syntheticMembership, event };
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Helper: check if an API result is an error response.
 */
export function isErrorResponse(
  result: { userId: string } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Safely parse JSON from a request body.
 * Returns the parsed body or a 400 NextResponse if the JSON is malformed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeParseBody<T = any>(
  request: Request,
): Promise<T | NextResponse> {
  try {
    return await request.json() as T;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }
}
