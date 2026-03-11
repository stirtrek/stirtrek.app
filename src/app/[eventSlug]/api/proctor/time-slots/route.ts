import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventProctor,
  isErrorResponse,
} from "@/lib/events/api-helpers";

/**
 * GET /api/proctor/time-slots
 * Returns distinct session start times that have theater mappings.
 */
export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/proctor/time-slots", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventProctor(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    // Get all session IDs that have theater mappings
    const { data: mappings } = await admin
      .from("theater_sessions")
      .select("session_id")
      .eq("event_id", eventId);

    const mappedSessionIds = [...new Set((mappings ?? []).map((m) => m.session_id))];

    if (mappedSessionIds.length === 0) {
      return NextResponse.json({ time_slots: [] });
    }

    // Get distinct start times for those sessions
    const { data: sessions } = await admin
      .from("sessions")
      .select("starts_at, ends_at")
      .eq("event_id", eventId)
      .eq("is_service_session", false)
      .in("id", mappedSessionIds)
      .order("starts_at", { ascending: true });

    // Deduplicate by starts_at
    const seen = new Set<string>();
    const timeSlots = (sessions ?? [])
      .filter((s) => {
        if (!s.starts_at || seen.has(s.starts_at)) return false;
        seen.add(s.starts_at);
        return true;
      })
      .map((s) => ({
        starts_at: s.starts_at,
        ends_at: s.ends_at,
      }));

    return NextResponse.json({ time_slots: timeSlots });
  });
}
