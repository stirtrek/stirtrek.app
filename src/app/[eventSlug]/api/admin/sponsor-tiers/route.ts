import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";
import type { SponsorTierConfig } from "@/lib/types";

function isValidTierConfig(t: unknown): t is SponsorTierConfig {
  if (typeof t !== "object" || t === null) return false;
  const obj = t as Record<string, unknown>;
  return (
    typeof obj.key === "string" &&
    obj.key.length > 0 &&
    typeof obj.label === "string" &&
    obj.label.length > 0 &&
    typeof obj.sort_order === "number" &&
    typeof obj.has_booth === "boolean"
  );
}

export async function PUT(request: NextRequest) {
  const eventId = getEventId(request);
  const auth = await requireEventAdmin(eventId);
  if (isErrorResponse(auth)) return auth;

  const body = await safeParseBody(request);
  if (body instanceof NextResponse) return body;
  const { tiers } = body;

  if (!Array.isArray(tiers) || tiers.length === 0) {
    return NextResponse.json(
      { error: "At least one tier is required" },
      { status: 400 },
    );
  }

  if (!tiers.every(isValidTierConfig)) {
    return NextResponse.json(
      { error: "Each tier must have key, label, sort_order, and has_booth" },
      { status: 400 },
    );
  }

  // Ensure unique keys
  const keys = tiers.map((t: SponsorTierConfig) => t.key);
  if (new Set(keys).size !== keys.length) {
    return NextResponse.json(
      { error: "Tier keys must be unique" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .update({
      sponsor_tiers: tiers,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tiers });
}
