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
 * Bulk assign theaters to a session.
 * Replaces all existing theater mappings for the given session.
 */
export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/theater-sessions/bulk", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { session_id, theater_ids } = body;

    if (!session_id || !Array.isArray(theater_ids)) {
      return NextResponse.json(
        { error: "session_id and theater_ids[] are required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Delete existing mappings for this session
    const { error: deleteError } = await admin
      .from("theater_sessions")
      .delete()
      .eq("event_id", eventId)
      .eq("session_id", session_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Insert new mappings (if any)
    if (theater_ids.length > 0) {
      const rows = theater_ids.map((theater_id: string) => ({
        event_id: eventId,
        theater_id,
        session_id,
      }));

      const { error: insertError } = await admin
        .from("theater_sessions")
        .insert(rows);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  });
}
