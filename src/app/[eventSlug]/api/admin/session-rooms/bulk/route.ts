import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

/**
 * Bulk assign rooms to a session.
 * Replaces all existing room mappings for the given session.
 */
export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/session-rooms/bulk", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { session_id, room_ids } = body;

    if (!session_id || !Array.isArray(room_ids)) {
      return NextResponse.json(
        { error: "session_id and room_ids[] are required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Delete existing mappings for this session
    const { error: deleteError } = await admin
      .from("session_rooms")
      .delete()
      .eq("event_id", eventId)
      .eq("session_id", session_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Insert new mappings (if any)
    if (room_ids.length > 0) {
      const rows = room_ids.map((room_id: number) => ({
        event_id: eventId,
        room_id,
        session_id,
      }));

      const { error: insertError } = await admin
        .from("session_rooms")
        .insert(rows);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  });
}
