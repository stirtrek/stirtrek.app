import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";
import { DEFAULT_SPONSOR_TIERS } from "@/lib/constants";
import type { SponsorTierConfig } from "@/lib/types";

async function getValidTiers(eventId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("sponsor_tiers")
    .eq("id", eventId)
    .single();

  const tiers: SponsorTierConfig[] = event?.sponsor_tiers ?? DEFAULT_SPONSOR_TIERS;
  return new Set(tiers.map((t) => t.key));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/sponsors/[id]", "PUT", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      tier,
      logo_url,
      description,
      website_url,
      booth_location,
      sort_order,
      is_active,
    } = body;

    if (tier !== undefined) {
      const validTiers = await getValidTiers(eventId);
      if (!validTiers.has(tier)) {
        return NextResponse.json(
          { error: `Invalid tier. Valid tiers: ${[...validTiers].join(", ")}` },
          { status: 400 },
        );
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (tier !== undefined) updates.tier = tier;
    if (logo_url !== undefined) updates.logo_url = logo_url?.trim() || null;
    if (description !== undefined) updates.description = description?.trim() || null;
    if (website_url !== undefined) updates.website_url = website_url?.trim() || null;
    if (booth_location !== undefined) updates.booth_location = booth_location?.trim() || null;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_active !== undefined) updates.is_active = is_active;

    const admin = createAdminClient();
    const { data: sponsor, error } = await admin
      .from("sponsors")
      .update(updates)
      .eq("id", id)
      .eq("event_id", eventId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!sponsor) {
      return NextResponse.json({ error: "Sponsor not found" }, { status: 404 });
    }

    return NextResponse.json({ sponsor });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/sponsors/[id]", "DELETE", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const { id } = await params;
    const admin = createAdminClient();

    const { error } = await admin
      .from("sponsors")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
