import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getEventId } from "@/lib/events/api-helpers";

export async function PUT(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/sponsor/company", "PUT", async () => {
    const eventId = getEventId(request);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: membership } = await admin
      .from("event_memberships")
      .select("is_sponsor")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!membership?.is_sponsor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const sponsorId = (body.sponsor_id || "").trim();

    if (!sponsorId) {
      return NextResponse.json(
        { error: "Please select a company" },
        { status: 400 },
      );
    }

    // Validate the sponsor exists and is active for this event
    const { data: sponsor } = await admin
      .from("sponsors")
      .select("id")
      .eq("id", sponsorId)
      .eq("event_id", eventId)
      .eq("is_active", true)
      .single();

    if (!sponsor) {
      return NextResponse.json(
        { error: "Invalid sponsor selection" },
        { status: 400 },
      );
    }

    // Update event_memberships for event-scoped sponsor status
    const { error } = await admin
      .from("event_memberships")
      .update({ sponsor_id: sponsorId })
      .eq("event_id", eventId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
