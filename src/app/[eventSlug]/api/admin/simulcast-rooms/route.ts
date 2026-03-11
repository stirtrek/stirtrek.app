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
 * GET /api/admin/simulcast-rooms
 * Returns simulcast config, all rooms, and which rooms have sessions (source rooms).
 */
export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/simulcast-rooms", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    const [simulcastRes, roomsRes, sessionsRes] = await Promise.all([
      admin
        .from("simulcast_rooms")
        .select("*")
        .eq("event_id", eventId),
      admin
        .from("rooms")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true }),
      admin
        .from("sessions")
        .select("room_id")
        .eq("event_id", eventId)
        .eq("is_service_session", false)
        .not("room_id", "is", null),
    ]);

    // Distinct room IDs that have sessions assigned (source rooms)
    const sourceRooms = [
      ...new Set((sessionsRes.data ?? []).map((s) => s.room_id as number)),
    ];

    return NextResponse.json({
      simulcast_rooms: simulcastRes.data ?? [],
      rooms: roomsRes.data ?? [],
      source_rooms: sourceRooms,
    });
  });
}

/**
 * POST /api/admin/simulcast-rooms
 * Add a simulcast mapping: source_room_id → target_room_id
 */
export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/simulcast-rooms", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { source_room_id, target_room_id } = body;

    if (!source_room_id || !target_room_id) {
      return NextResponse.json(
        { error: "source_room_id and target_room_id are required" },
        { status: 400 },
      );
    }

    if (source_room_id === target_room_id) {
      return NextResponse.json(
        { error: "A room cannot simulcast to itself" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("simulcast_rooms")
      .insert({
        event_id: eventId,
        source_room_id,
        target_room_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ simulcast_room: data }, { status: 201 });
  });
}

/**
 * DELETE /api/admin/simulcast-rooms
 * Remove a simulcast mapping by ID.
 */
export async function DELETE(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/simulcast-rooms", "DELETE", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("simulcast_rooms")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
