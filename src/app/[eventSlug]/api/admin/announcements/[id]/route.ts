import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/announcements/[id]",
    "PATCH",
    async () => {
      const { id } = await params;
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const admin = createAdminClient();

      const { data: existing } = await admin
        .from("announcements")
        .select("id, status")
        .eq("id", id)
        .eq("event_id", eventId)
        .single();

      if (!existing) {
        return NextResponse.json(
          { error: "Announcement not found" },
          { status: 404 },
        );
      }

      if (existing.status === "sent") {
        return NextResponse.json(
          { error: "Cannot edit a sent announcement" },
          { status: 400 },
        );
      }

      const body = await safeParseBody(request);
      if (body instanceof NextResponse) return body;
      const updateData: Record<string, unknown> = {};

      if (body.message !== undefined) {
        if (!body.message?.trim()) {
          return NextResponse.json(
            { error: "Message is required" },
            { status: 400 },
          );
        }
        updateData.message = body.message.trim();
      }

      if (body.scheduled_for !== undefined) {
        if (body.scheduled_for) {
          updateData.scheduled_for = body.scheduled_for;
          updateData.status = "scheduled";
        } else {
          updateData.scheduled_for = null;
          updateData.status = "draft";
        }
      }

      if (body.status === "draft") {
        updateData.status = "draft";
        updateData.scheduled_for = null;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: "No changes" }, { status: 400 });
      }

      const { error } = await admin
        .from("announcements")
        .update(updateData)
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    },
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/announcements/[id]",
    "DELETE",
    async () => {
      const { id } = await params;
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const admin = createAdminClient();

      const { error, count } = await admin
        .from("announcements")
        .delete()
        .eq("id", id)
        .eq("event_id", eventId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (count === 0) {
        return NextResponse.json(
          { error: "Announcement not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true });
    },
  );
}
