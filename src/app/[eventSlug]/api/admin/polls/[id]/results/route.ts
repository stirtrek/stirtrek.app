import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/polls/[id]/results",
    "GET",
    async () => {
      const { id } = await params;
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const admin = createAdminClient();

      const { data: poll } = await admin
        .from("polls")
        .select("id, question, status, allow_multiple")
        .eq("id", id)
        .eq("event_id", eventId)
        .single();

      if (!poll) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 });
      }

      const { data: results, error } = await admin.rpc("get_poll_results", {
        p_poll_id: id,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { count } = await admin
        .from("poll_responses")
        .select("*", { count: "exact", head: true })
        .eq("poll_id", id);

      return NextResponse.json({
        poll,
        results: results ?? [],
        total_votes: count ?? 0,
      });
    },
  );
}
