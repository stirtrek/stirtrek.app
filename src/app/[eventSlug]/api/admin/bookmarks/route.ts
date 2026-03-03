import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/bookmarks", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    // Get all bookmark counts per session for this event
    const { data: bookmarks } = await admin
      .from("personal_schedule")
      .select("session_id")
      .eq("event_id", eventId);

    const counts: Record<string, number> = {};
    for (const b of bookmarks ?? []) {
      counts[b.session_id] = (counts[b.session_id] || 0) + 1;
    }

    // Get all non-service sessions for this event with room info
    const { data: sessions } = await admin
      .from("sessions")
      .select(
        "id, title, starts_at, room_id, is_service_session, rooms(name)",
      )
      .eq("event_id", eventId)
      .eq("is_service_session", false)
      .order("starts_at", { ascending: true });

    const result = (sessions ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      starts_at: s.starts_at,
      room: s.rooms ? (s.rooms as unknown as { name: string }).name : null,
      bookmarks: counts[s.id] ?? 0,
    }));

    // Sort by bookmark count descending
    result.sort((a, b) => b.bookmarks - a.bookmarks);

    return NextResponse.json({ sessions: result });
  });
}
