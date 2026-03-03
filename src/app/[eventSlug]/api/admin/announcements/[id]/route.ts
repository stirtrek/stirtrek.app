import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

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
