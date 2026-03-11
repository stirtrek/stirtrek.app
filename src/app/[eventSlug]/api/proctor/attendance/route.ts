import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventProctor,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

/**
 * GET /api/proctor/attendance?time_slot=ISO_TIMESTAMP
 * Returns all theaters with their mapped sessions and existing counts
 * for the selected time slot.
 */
export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/proctor/attendance", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventProctor(eventId);
    if (isErrorResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const timeSlot = searchParams.get("time_slot");

    const admin = createAdminClient();

    // Get all active theaters
    const { data: theaters } = await admin
      .from("theaters")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    // Get sessions for this time slot (if specified)
    let sessionsQuery = admin
      .from("sessions")
      .select("id, title, starts_at, ends_at")
      .eq("event_id", eventId)
      .eq("is_service_session", false);

    if (timeSlot) {
      sessionsQuery = sessionsQuery.eq("starts_at", timeSlot);
    }

    const { data: sessions } = await sessionsQuery;
    const sessionIds = (sessions ?? []).map((s) => s.id);

    // Get theater-session mappings for these sessions
    let mappings: { id: string; theater_id: string; session_id: string }[] = [];
    if (sessionIds.length > 0) {
      const { data } = await admin
        .from("theater_sessions")
        .select("id, theater_id, session_id")
        .eq("event_id", eventId)
        .in("session_id", sessionIds);
      mappings = data ?? [];
    }

    // Get existing attendance counts for these sessions
    let counts: { id: string; theater_id: string; session_id: string; count: number; counted_by: string; counted_at: string; updated_at: string }[] = [];
    if (sessionIds.length > 0) {
      const { data } = await admin
        .from("attendance_counts")
        .select("*")
        .eq("event_id", eventId)
        .in("session_id", sessionIds);
      counts = data ?? [];
    }

    // Get counter profiles for display
    const counterIds = [...new Set(counts.map((c) => c.counted_by))];
    let profiles: { id: string; display_name: string | null; first_name: string | null; last_name: string | null }[] = [];
    if (counterIds.length > 0) {
      const { data } = await admin
        .from("profiles")
        .select("id, display_name, first_name, last_name")
        .in("id", counterIds);
      profiles = data ?? [];
    }

    // Build lookup maps
    const sessionMap = new Map((sessions ?? []).map((s) => [s.id, s]));
    const countMap = new Map(counts.map((c) => [`${c.theater_id}:${c.session_id}`, c]));
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Build response: one entry per theater that has a mapped session
    const theaterEntries = (theaters ?? []).map((theater) => {
      // Find all mappings for this theater in the current time slot
      const theaterMappings = mappings.filter((m) => m.theater_id === theater.id);

      // A theater should have at most one session per time slot
      const mapping = theaterMappings[0] ?? null;
      const session = mapping ? sessionMap.get(mapping.session_id) ?? null : null;
      const count = mapping ? countMap.get(`${theater.id}:${mapping.session_id}`) ?? null : null;
      const counter = count ? profileMap.get(count.counted_by) : null;

      return {
        theater,
        session,
        mapping,
        attendance: count
          ? {
              ...count,
              counted_by_name: counter
                ? `${counter.first_name || ""} ${counter.last_name || ""}`.trim() || counter.display_name || "Unknown"
                : "Unknown",
            }
          : null,
      };
    });

    // Summary stats
    const mappedTheaters = theaterEntries.filter((e) => e.session !== null);
    const countedTheaters = theaterEntries.filter((e) => e.attendance !== null);

    return NextResponse.json({
      theaters: theaterEntries,
      summary: {
        total_theaters: theaters?.length ?? 0,
        mapped_theaters: mappedTheaters.length,
        counted_theaters: countedTheaters.length,
        total_attendance: countedTheaters.reduce((sum, e) => sum + (e.attendance?.count ?? 0), 0),
      },
    });
  });
}

/**
 * POST /api/proctor/attendance
 * Upsert an attendance count for a theater/session.
 * Body: { theater_id, session_id, count }
 */
export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/proctor/attendance", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventProctor(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { theater_id, session_id, count } = body;

    if (!theater_id || !session_id || count === undefined || count === null) {
      return NextResponse.json(
        { error: "theater_id, session_id, and count are required" },
        { status: 400 },
      );
    }

    if (typeof count !== "number" || count < 0 || !Number.isInteger(count)) {
      return NextResponse.json(
        { error: "count must be a non-negative integer" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("attendance_counts")
      .upsert(
        {
          event_id: eventId,
          theater_id,
          session_id,
          count,
          counted_by: auth.userId,
          counted_at: new Date().toISOString(),
        },
        { onConflict: "event_id,theater_id,session_id" },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attendance: data });
  });
}
