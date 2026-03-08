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
  return telemetry.trackAPIRoute("/api/admin/rooms", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("rooms")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rooms: data ?? [] });
  });
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/rooms", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Room name is required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Get next sort order and next id
    const { data: existing } = await admin
      .from("rooms")
      .select("id, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
    const nextId = (existing?.[0]?.id ?? 0) + 1;

    const { data: room, error } = await admin
      .from("rooms")
      .insert({
        id: nextId,
        event_id: eventId,
        name: name.trim(),
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ room }, { status: 201 });
  });
}
