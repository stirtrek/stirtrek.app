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
  return telemetry.trackAPIRoute(
    "/api/admin/polls/[id]/status",
    "PUT",
    async () => {
      const { id } = await params;
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const body = await request.json();
      const { status: newStatus } = body;

      const admin = createAdminClient();

      const { data: poll } = await admin
        .from("polls")
        .select("status")
        .eq("id", id)
        .eq("event_id", eventId)
        .single();

      if (!poll) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 });
      }

      const validTransitions: Record<string, string> = {
        draft: "active",
        active: "closed",
      };

      if (validTransitions[poll.status] !== newStatus) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${poll.status} to ${newStatus}`,
          },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = { status: newStatus };

      if (newStatus === "active") updateData.opened_at = now;
      if (newStatus === "closed") updateData.closed_at = now;

      const { error } = await admin
        .from("polls")
        .update(updateData)
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    },
  );
}
