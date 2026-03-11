import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getEventId, safeParseBody, resolveEffectiveUser, blockSimulatedWrite } from "@/lib/events/api-helpers";

export async function PATCH(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/emergency/replies/mark-read",
    "PATCH",
    async () => {
      const eventId = getEventId(request);
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { isSimulating } = await resolveEffectiveUser(request, user.id);
      const blocked = blockSimulatedWrite(isSimulating);
      if (blocked) return blocked;

      const body = await safeParseBody(request);
      if (body instanceof NextResponse) return body;
      const replyIds: string[] = body.reply_ids;

      if (!Array.isArray(replyIds) || replyIds.length === 0) {
        return NextResponse.json(
          { error: "reply_ids array is required" },
          { status: 400 },
        );
      }

      // RLS ensures users can only update replies to their own messages
      const { error } = await supabase
        .from("emergency_replies")
        .update({ is_read: true })
        .in("id", replyIds)
        .eq("event_id", eventId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    },
  );
}
