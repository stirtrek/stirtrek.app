import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/sponsor-accounts/export",
    "GET",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const { searchParams } = new URL(request.url);
      const sponsorId = searchParams.get("sponsor_id");

      if (!sponsorId) {
        return NextResponse.json(
          { error: "sponsor_id is required" },
          { status: 400 },
        );
      }

      const admin = createAdminClient();

      // Get the sponsor name for the filename (scoped to this event)
      const { data: sponsor } = await admin
        .from("sponsors")
        .select("name")
        .eq("id", sponsorId)
        .eq("event_id", eventId)
        .single();

      if (!sponsor) {
        return NextResponse.json(
          { error: "Sponsor not found" },
          { status: 404 },
        );
      }

      // Find all profiles assigned to this sponsor company for this event
      const { data: sponsorMemberships } = await admin
        .from("event_memberships")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("is_sponsor", true)
        .eq("sponsor_id", sponsorId);

      const profileIds = (sponsorMemberships ?? []).map((m) => m.user_id);

      if (profileIds.length === 0) {
        const csv =
          "Email,First Name,Last Name,Scanned At,Scanned By,Notes";
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${escapeCsvField(sponsor.name)}-leads.csv"`,
          },
        });
      }

      // Get all leads from all reps of this company for this event
      const { data: leads, error } = await admin
        .from("leads")
        .select(
          "attendee_email, attendee_first_name, attendee_last_name, scanned_at, notes, sponsor_profile_id, profiles!sponsor_profile_id(email)",
        )
        .eq("event_id", eventId)
        .in("sponsor_profile_id", profileIds)
        .order("scanned_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const header =
        "Email,First Name,Last Name,Scanned At,Scanned By,Notes";
      const rows = (leads ?? []).map((lead) => {
        const scannedBy =
          (lead.profiles as unknown as { email: string })?.email ?? "";
        return [
          escapeCsvField(lead.attendee_email),
          escapeCsvField(lead.attendee_first_name || ""),
          escapeCsvField(lead.attendee_last_name || ""),
          escapeCsvField(new Date(lead.scanned_at).toISOString()),
          escapeCsvField(scannedBy),
          escapeCsvField(lead.notes || ""),
        ].join(",");
      });

      const csv = [header, ...rows].join("\n");
      const safeName = sponsor.name
        .replace(/[^a-zA-Z0-9]/g, "-")
        .toLowerCase();
      const date = new Date().toISOString().split("T")[0];

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${safeName}-leads-${date}.csv"`,
        },
      });
    },
  );
}
