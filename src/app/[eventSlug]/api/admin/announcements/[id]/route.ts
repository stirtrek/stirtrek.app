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

      const { data: announcement } = await admin
        .from("announcements")
        .select("status")
        .eq("id", id)
        .eq("event_id", eventId)
        .single();

      if (!announcement) {
        return NextResponse.json(
          { error: "Announcement not found" },
          { status: 404 },
        );
      }

      if (announcement.status !== "draft") {
        return NextResponse.json(
          { error: "Only draft announcements can be deleted" },
          { status: 400 },
        );
      }

      const { error } = await admin
        .from("announcements")
        .delete()
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    },
  );
}
