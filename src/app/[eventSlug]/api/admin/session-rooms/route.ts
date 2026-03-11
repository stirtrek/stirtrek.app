import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/session-rooms", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    let query = admin
      .from("session_rooms")
      .select("*")
      .eq("event_id", eventId);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session_rooms: data ?? [] });
  });
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/session-rooms", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { room_id, session_id } = body;

    if (!room_id || !session_id) {
      return NextResponse.json(
        { error: "room_id and session_id are required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("session_rooms")
      .insert({
        event_id: eventId,
        room_id,
        session_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session_room: data }, { status: 201 });
  });
}

export async function DELETE(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/session-rooms", "DELETE", async () => {
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
      .from("session_rooms")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
