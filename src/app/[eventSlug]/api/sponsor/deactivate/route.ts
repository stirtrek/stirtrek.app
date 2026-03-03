import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getEventId } from "@/lib/events/api-helpers";

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/sponsor/deactivate",
    "POST",
    async () => {
      const eventId = getEventId(request);
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Update profiles (backward compat)
      const { error } = await supabase
        .from("profiles")
        .update({ is_sponsor: false, sponsor_id: null })
        .eq("id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Also update event_memberships for event-scoped sponsor status
      const admin = createAdminClient();
      await admin
        .from("event_memberships")
        .update({ is_sponsor: false, sponsor_id: null })
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      telemetry.trackAuthEvent("sponsor_deactivate", { userId: user.id });

      return NextResponse.json({ success: true });
    },
  );
}
