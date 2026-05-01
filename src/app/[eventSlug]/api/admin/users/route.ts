import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  requireEventAdminOnly,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

function getPagination(request: Request, defaultLimit = 50) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || String(defaultLimit), 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/users", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    const search = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const { page, limit, offset } = getPagination(request);

    // Fetch linked speakers for this event to tag users paired as speakers
    const { data: speakers } = await admin
      .from("speakers")
      .select("user_id")
      .eq("event_id", eventId)
      .not("user_id", "is", null);
    const speakerUserIds = new Set((speakers ?? []).map((s) => s.user_id));

    // Single query: pull memberships with embedded profile rows. Avoids a
    // separate `.in("id", [hundreds of IDs])` query that overflows the
    // PostgREST request URL once an event has more than ~200 members.
    let query = admin
      .from("event_memberships")
      .select(
        "user_id, role, is_sponsor, sponsor_id, profiles!inner(id, email, display_name, first_name, last_name, is_super_admin, created_at)",
        { count: "exact" },
      )
      .eq("event_id", eventId)
      .order("created_at", { foreignTable: "profiles", ascending: false });

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%`,
        { foreignTable: "profiles" },
      );
    }

    const { data: rows, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Row = {
      user_id: string;
      role: string;
      is_sponsor: boolean | null;
      sponsor_id: string | null;
      profiles: {
        id: string;
        email: string | null;
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
        is_super_admin: boolean | null;
        created_at: string;
      };
    };

    const users = ((rows ?? []) as unknown as Row[]).map((r) => ({
      ...r.profiles,
      role: r.role ?? "attendee",
      is_sponsor: r.is_sponsor ?? false,
      sponsor_id: r.sponsor_id ?? null,
      is_speaker: speakerUserIds.has(r.user_id),
    }));

    return NextResponse.json({
      users,
      pagination: { page, limit, total: count ?? 0 },
    });
  });
}

export async function PUT(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/users", "PUT", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdminOnly(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { profile_id, role } = body;

    if (!profile_id || !["attendee", "proctor", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Update the event membership role (not profiles.role)
    const { error } = await admin
      .from("event_memberships")
      .update({ role })
      .eq("event_id", eventId)
      .eq("user_id", profile_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    telemetry.trackAuthEvent("role_change", {
      profileId: profile_id,
      role,
      eventId,
    });

    return NextResponse.json({ success: true });
  });
}
