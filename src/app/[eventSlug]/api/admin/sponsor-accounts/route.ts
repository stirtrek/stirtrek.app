import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/sponsor-accounts",
    "GET",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const admin = createAdminClient();

      // Get sponsor memberships for this event
      const { data: sponsorMemberships } = await admin
        .from("event_memberships")
        .select("user_id, sponsor_id")
        .eq("event_id", eventId)
        .eq("is_sponsor", true);

      if (!sponsorMemberships || sponsorMemberships.length === 0) {
        // Get all active sponsors for the dropdown
        const { data: sponsors } = await admin
          .from("sponsors")
          .select("id, name, tier")
          .eq("event_id", eventId)
          .eq("is_active", true)
          .order("sort_order");

        return NextResponse.json({ accounts: [], sponsors: sponsors ?? [] });
      }

      const memberIds = sponsorMemberships.map((m) => m.user_id);
      const memberSponsorMap = new Map(
        sponsorMemberships.map((m) => [m.user_id, m.sponsor_id]),
      );

      // Get profiles for these sponsor users
      const { data: sponsorProfiles, error: profilesError } = await admin
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", memberIds)
        .order("email");

      if (profilesError) {
        return NextResponse.json(
          { error: profilesError.message },
          { status: 500 },
        );
      }

      // Get all active sponsors for this event
      const { data: sponsors } = await admin
        .from("sponsors")
        .select("id, name, tier")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("sort_order");

      // Get lead counts per sponsor profile for this event
      const { data: leadCounts } = await admin
        .from("leads")
        .select("sponsor_profile_id")
        .eq("event_id", eventId);

      const countMap: Record<string, number> = {};
      for (const lead of leadCounts ?? []) {
        countMap[lead.sponsor_profile_id] =
          (countMap[lead.sponsor_profile_id] || 0) + 1;
      }

      const sponsorMap: Record<string, { name: string; tier: string }> = {};
      for (const s of sponsors ?? []) {
        sponsorMap[s.id] = { name: s.name, tier: s.tier };
      }

      const accounts = (sponsorProfiles ?? []).map((p) => {
        const sponsorId = memberSponsorMap.get(p.id) ?? null;
        return {
          id: p.id,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          sponsor_id: sponsorId,
          sponsor_name: sponsorId
            ? (sponsorMap[sponsorId]?.name ?? null)
            : null,
          sponsor_tier: sponsorId
            ? (sponsorMap[sponsorId]?.tier ?? null)
            : null,
          lead_count: countMap[p.id] || 0,
        };
      });

      return NextResponse.json({ accounts, sponsors: sponsors ?? [] });
    },
  );
}

export async function PUT(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/sponsor-accounts",
    "PUT",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const body = await request.json();
      const { profile_id, sponsor_id } = body;

      if (!profile_id) {
        return NextResponse.json(
          { error: "profile_id is required" },
          { status: 400 },
        );
      }

      const admin = createAdminClient();

      // Update the event membership's sponsor_id
      const { error } = await admin
        .from("event_memberships")
        .update({ sponsor_id: sponsor_id || null })
        .eq("event_id", eventId)
        .eq("user_id", profile_id)
        .eq("is_sponsor", true);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    },
  );
}
