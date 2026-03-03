import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

const VALID_STATUSES = ["unresponded", "acknowledged", "closed"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/emergency/messages/[messageId]/status",
    "PATCH",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const { messageId } = await params;

      const body = await request.json();
      const newStatus = body.status;

      if (!VALID_STATUSES.includes(newStatus)) {
        return NextResponse.json(
          {
            error:
              "Invalid status. Must be: unresponded, acknowledged, or closed",
          },
          { status: 400 },
        );
      }

      const admin = createAdminClient();
      const { error } = await admin
        .from("emergency_messages")
        .update({ status: newStatus })
        .eq("id", messageId)
        .eq("event_id", eventId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      telemetry.trackEmergencyMessage("status_change", {
        messageId,
        status: newStatus,
      });

      return NextResponse.json({ success: true });
    },
  );
}
