import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { sendPushToAll } from "@/lib/push";
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
  return telemetry.trackAPIRoute(
    "/api/admin/polls/[id]/status",
    "PUT",
    async () => {
      const { id } = await params;
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const body = await safeParseBody(request);
      if (body instanceof NextResponse) return body;
      const { status: newStatus } = body;

      const admin = createAdminClient();

      const { data: poll } = await admin
        .from("polls")
        .select("status, question")
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

      // Send push notification when poll goes live
      if (newStatus === "active") {
        const { data: event } = await admin
          .from("events")
          .select("name, short_name, logo_url")
          .eq("id", eventId)
          .single();

        const title = event
          ? `${event.short_name || event.name}: New Poll`
          : "New Poll";

        sendPushToAll(
          {
            title,
            body: poll.question,
            url: "/polls",
            icon: event?.logo_url || undefined,
          },
          eventId,
        ).catch((err) =>
          console.error(`Poll push notification failed (${id}):`, err),
        );
      }

      return NextResponse.json({ success: true });
    },
  );
}
