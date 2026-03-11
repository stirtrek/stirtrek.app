import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  resolveEffectiveUser,
} from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/emergency/unread-count",
    "GET",
    async () => {
      const eventId = getEventId(request);
      const adminAuth = await requireEventAdmin(eventId);
      const isAdmin = !isErrorResponse(adminAuth);

      // If the user isn't even authenticated, return 401
      if (!isAdmin) {
        const status = adminAuth.status;
        if (status === 401) return adminAuth;
      }

      if (isAdmin) {
        // Admins: count unread emergency messages
        const admin = createAdminClient();
        const { count, error } = await admin
          .from("emergency_messages")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("status", "unresponded");

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ count: count ?? 0 });
      }

      // Attendees: count unread replies to their messages
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { effectiveUserId } = await resolveEffectiveUser(request, user.id);

      const admin = createAdminClient();
      const { data: myMessages } = await admin
        .from("emergency_messages")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", effectiveUserId);

      const messageIds = (myMessages ?? []).map((m) => m.id);

      if (messageIds.length === 0) {
        return NextResponse.json({ count: 0 });
      }

      const { count, error } = await admin
        .from("emergency_replies")
        .select("*", { count: "exact", head: true })
        .in("message_id", messageIds)
        .eq("is_read", false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ count: count ?? 0 });
    },
  );
}
