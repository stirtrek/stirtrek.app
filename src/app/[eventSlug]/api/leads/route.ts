import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getEventId } from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/leads", "GET", async () => {
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

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("event_id", eventId)
      .eq("sponsor_profile_id", user.id)
      .order("scanned_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  });
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/leads", "POST", async () => {
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
    const attendeeEmail = (body.attendee_email || "").trim();
    const attendeeFirstName = (body.attendee_first_name || "").trim() || null;
    const attendeeLastName = (body.attendee_last_name || "").trim() || null;

    if (!attendeeEmail) {
      return NextResponse.json(
        { error: "Attendee email is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .insert({
        sponsor_profile_id: user.id,
        attendee_email: attendeeEmail,
        attendee_first_name: attendeeFirstName,
        attendee_last_name: attendeeLastName,
        event_id: eventId,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation — duplicate scan
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "You've already scanned this attendee" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    telemetry.trackLeadCapture({ sponsorId: user.id, attendeeEmail });

    return NextResponse.json(data, { status: 201 });
  });
}
