import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/sessions/[id]", "PUT", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      starts_at,
      ends_at,
      room_id,
      speaker_ids,
      is_service_session,
    } = body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (starts_at !== undefined) updates.starts_at = starts_at || null;
    if (ends_at !== undefined) updates.ends_at = ends_at || null;
    if (room_id !== undefined) updates.room_id = room_id || null;
    if (is_service_session !== undefined) updates.is_service_session = is_service_session;

    const admin = createAdminClient();
    const { data: session, error } = await admin
      .from("sessions")
      .update(updates)
      .eq("id", id)
      .eq("event_id", eventId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Update speaker assignments if provided
    if (Array.isArray(speaker_ids)) {
      await admin
        .from("session_speakers")
        .delete()
        .eq("session_id", id)
        .eq("event_id", eventId);

      if (speaker_ids.length > 0) {
        const rows = speaker_ids.map((speakerId: string) => ({
          event_id: eventId,
          session_id: id,
          speaker_id: speakerId,
        }));

        await admin.from("session_speakers").insert(rows);
      }
    }

    return NextResponse.json({ session });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/sessions/[id]", "DELETE", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const { id } = await params;
    const admin = createAdminClient();

    // Clean up junction tables
    await admin
      .from("session_speakers")
      .delete()
      .eq("session_id", id)
      .eq("event_id", eventId);

    await admin
      .from("session_categories")
      .delete()
      .eq("session_id", id)
      .eq("event_id", eventId);

    const { error } = await admin
      .from("sessions")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
