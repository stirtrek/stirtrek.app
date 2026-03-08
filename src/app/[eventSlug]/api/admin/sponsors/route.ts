import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
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

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/sponsors", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sponsors")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sponsors: data ?? [] });
  });
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/sponsors", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
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

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }

    const validTiers = await getValidTiers(eventId);
    if (!tier || !validTiers.has(tier)) {
      return NextResponse.json(
        { error: `Invalid tier. Valid tiers: ${[...validTiers].join(", ")}` },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: sponsor, error } = await admin
      .from("sponsors")
      .insert({
        event_id: eventId,
        name: name.trim(),
        tier,
        logo_url: logo_url?.trim() || null,
        description: description?.trim() || null,
        website_url: website_url?.trim() || null,
        booth_location: booth_location?.trim() || null,
        sort_order: typeof sort_order === "number" ? sort_order : 0,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sponsor }, { status: 201 });
  });
}
