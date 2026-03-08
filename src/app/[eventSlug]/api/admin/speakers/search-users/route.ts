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
  return telemetry.trackAPIRoute("/api/admin/speakers/search-users", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const admin = createAdminClient();
    const pattern = `%${q}%`;

    // Search profiles who are members of this event
    const { data: users, error } = await admin
      .from("event_memberships")
      .select("user_id, profiles(id, email, display_name, first_name, last_name)")
      .eq("event_id", eventId)
      .not("profiles", "is", null)
      .or(
        `profiles.email.ilike.${pattern},profiles.first_name.ilike.${pattern},profiles.last_name.ilike.${pattern},profiles.display_name.ilike.${pattern}`,
      )
      .limit(20);

    if (error) {
      // Fallback: if the joined filter fails, do a simpler two-step lookup
      const { data: members } = await admin
        .from("event_memberships")
        .select("user_id")
        .eq("event_id", eventId);

      if (!members || members.length === 0) {
        return NextResponse.json({ users: [] });
      }

      const memberIds = members.map((m) => m.user_id);
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, email, display_name, first_name, last_name")
        .in("id", memberIds)
        .or(
          `email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},display_name.ilike.${pattern}`,
        )
        .limit(20);

      return NextResponse.json({
        users: (profiles ?? []).map((p) => ({
          id: p.id,
          email: p.email,
          display_name: p.display_name,
          first_name: p.first_name,
          last_name: p.last_name,
        })),
      });
    }

    const result = (users ?? [])
      .map((m) => {
        const p = m.profiles as unknown as {
          id: string;
          email: string;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
        } | null;
        if (!p) return null;
        return {
          id: p.id,
          email: p.email,
          display_name: p.display_name,
          first_name: p.first_name,
          last_name: p.last_name,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ users: result });
  });
}
