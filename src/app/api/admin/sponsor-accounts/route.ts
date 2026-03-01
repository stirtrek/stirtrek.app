import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";

async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "staff"].includes(profile.role)) return null;

  return user;
}

export async function GET() {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/sponsor-accounts",
    "GET",
    async () => {
      const user = await checkAdmin();
      if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const admin = createAdminClient();

      // Get all sponsor profiles with their assigned company
      const { data: sponsorProfiles, error: profilesError } = await admin
        .from("profiles")
        .select("id, email, first_name, last_name, sponsor_id")
        .eq("is_sponsor", true)
        .order("email");

      if (profilesError) {
        return NextResponse.json(
          { error: profilesError.message },
          { status: 500 },
        );
      }

      // Get all sponsors for the name lookup and dropdown
      const { data: sponsors } = await admin
        .from("sponsors")
        .select("id, name, tier")
        .eq("is_active", true)
        .order("sort_order");

      // Get lead counts per sponsor profile
      const { data: leadCounts } = await admin
        .from("leads")
        .select("sponsor_profile_id");

      const countMap: Record<string, number> = {};
      for (const lead of leadCounts ?? []) {
        countMap[lead.sponsor_profile_id] =
          (countMap[lead.sponsor_profile_id] || 0) + 1;
      }

      const sponsorMap: Record<string, { name: string; tier: string }> = {};
      for (const s of sponsors ?? []) {
        sponsorMap[s.id] = { name: s.name, tier: s.tier };
      }

      const accounts = (sponsorProfiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        sponsor_id: p.sponsor_id,
        sponsor_name: p.sponsor_id
          ? (sponsorMap[p.sponsor_id]?.name ?? null)
          : null,
        sponsor_tier: p.sponsor_id
          ? (sponsorMap[p.sponsor_id]?.tier ?? null)
          : null,
        lead_count: countMap[p.id] || 0,
      }));

      return NextResponse.json({ accounts, sponsors: sponsors ?? [] });
    },
  );
}

export async function PUT(request: Request) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/sponsor-accounts",
    "PUT",
    async () => {
      const user = await checkAdmin();
      if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      const { profile_id, sponsor_id } = body;

      if (!profile_id) {
        return NextResponse.json(
          { error: "profile_id is required" },
          { status: 400 },
        );
      }

      const admin = createAdminClient();

      const { error } = await admin
        .from("profiles")
        .update({ sponsor_id: sponsor_id || null })
        .eq("id", profile_id)
        .eq("is_sponsor", true);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    },
  );
}
