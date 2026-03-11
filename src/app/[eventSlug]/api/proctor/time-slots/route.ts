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
 * Returns distinct session start times from non-service sessions
 * that have a room assigned.
 */
export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/proctor/time-slots", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventProctor(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    const { data: sessions } = await admin
      .from("sessions")
      .select("starts_at, ends_at")
      .eq("event_id", eventId)
      .eq("is_service_session", false)
      .not("room_id", "is", null)
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
