import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/rooms/[id]", "PUT", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const { id } = await params;
    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { name, sort_order } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const admin = createAdminClient();
    const { data: room, error } = await admin
      .from("rooms")
      .update(updates)
      .eq("id", Number(id))
      .eq("event_id", eventId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({ room });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/rooms/[id]", "DELETE", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin
      .from("rooms")
      .delete()
      .eq("id", Number(id))
      .eq("event_id", eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
