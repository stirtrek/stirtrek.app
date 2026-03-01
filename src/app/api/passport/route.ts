import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";

export async function GET() {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/passport", "GET", async () => {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!profile?.email) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 },
      );
    }

    const admin = createAdminClient();

    // Find all leads where this attendee was scanned, joining to the
    // scanner's profile to get their sponsor company assignment
    const { data: leads, error: leadsError } = await admin
      .from("leads")
      .select("sponsor_profile_id, profiles!sponsor_profile_id(sponsor_id)")
      .eq("attendee_email", profile.email);

    if (leadsError) {
      return NextResponse.json(
        { error: leadsError.message },
        { status: 500 },
      );
    }

    // Collect unique sponsor IDs from the leads
    const visitedSponsorIds = [
      ...new Set(
        (leads ?? [])
          .map(
            (l) =>
              (l.profiles as unknown as { sponsor_id: string | null })
                ?.sponsor_id,
          )
          .filter(Boolean),
      ),
    ];

    // Look up the sponsor names for matching with the external feed
    let visitedSponsorNames: string[] = [];

    if (visitedSponsorIds.length > 0) {
      const { data: sponsors } = await admin
        .from("sponsors")
        .select("name")
        .in("id", visitedSponsorIds);

      visitedSponsorNames = (sponsors ?? []).map((s) => s.name);
    }

    return NextResponse.json({
      visitedSponsorNames,
    });
  });
}
