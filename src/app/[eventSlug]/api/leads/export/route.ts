import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getEventId } from "@/lib/events/api-helpers";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/leads/export", "GET", async () => {
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

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("event_id", eventId)
      .eq("sponsor_profile_id", user.id)
      .order("scanned_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const header = "Email,First Name,Last Name,Scanned At,Notes";
    const rows = (leads || []).map((lead) =>
      [
        escapeCsvField(lead.attendee_email),
        escapeCsvField(lead.attendee_first_name || ""),
        escapeCsvField(lead.attendee_last_name || ""),
        escapeCsvField(new Date(lead.scanned_at).toISOString()),
        escapeCsvField(lead.notes || ""),
      ].join(","),
    );

    const csv = [header, ...rows].join("\n");
    const date = new Date().toISOString().split("T")[0];

    const { data: eventRecord } = await admin
      .from("events")
      .select("slug")
      .eq("id", eventId)
      .single();
    const slug = eventRecord?.slug ?? "event";

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${slug}-leads-${date}.csv"`,
      },
    });
  });
}
