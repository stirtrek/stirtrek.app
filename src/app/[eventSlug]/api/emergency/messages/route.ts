import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToAdmins } from "@/lib/push";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
  resolveEffectiveUser,
  blockSimulatedWrite,
} from "@/lib/events/api-helpers";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/emergency/messages", "GET", async () => {
    const eventId = getEventId(request);
    const adminAuth = await requireEventAdmin(eventId);
    const isAdmin = !isErrorResponse(adminAuth);

    // If the user isn't even authenticated, return 401
    if (!isAdmin) {
      // Check if it was a 401 (not authenticated) vs 403 (not admin)
      const status = adminAuth.status;
      if (status === 401) return adminAuth;
    }

    const admin = createAdminClient();

    if (isAdmin) {
      // Single nested fetch: messages + sender profile + replies + reply_sender profile.
      const { data: messages, error } = await admin
        .from("emergency_messages")
        .select(
          `*,
           sender:profiles!user_id(id, display_name, first_name, last_name, email),
           replies:emergency_replies(
             *,
             reply_sender:profiles!sender_id(id, display_name, first_name, last_name, email, is_super_admin)
           )`,
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .order("created_at", { referencedTable: "emergency_replies", ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const replySenderIds = [
        ...new Set(
          (messages ?? []).flatMap((m: any) =>
            (m.replies ?? []).map((r: any) => r.reply_sender?.id).filter(Boolean),
          ),
        ),
      ];

      const { data: replySenderMemberships } =
        replySenderIds.length > 0
          ? await admin
              .from("event_memberships")
              .select("user_id, role")
              .eq("event_id", eventId)
              .in("user_id", replySenderIds)
          : { data: [] };

      const membershipRoleMap = new Map(
        (replySenderMemberships ?? []).map((m) => [m.user_id, m.role]),
      );

      const enriched = (messages ?? []).map((m: any) => ({
        ...m,
        sender: m.sender
          ? {
              display_name: m.sender.display_name,
              first_name: m.sender.first_name,
              last_name: m.sender.last_name,
              email: m.sender.email,
            }
          : undefined,
        replies: (m.replies ?? []).map((r: any) => {
          const rs = r.reply_sender;
          return {
            ...r,
            reply_sender: rs
              ? {
                  display_name: rs.display_name,
                  first_name: rs.first_name,
                  last_name: rs.last_name,
                  email: rs.email,
                  role:
                    membershipRoleMap.get(rs.id) ??
                    (rs.is_super_admin ? "admin" : "attendee"),
                }
              : undefined,
          };
        }),
      }));

      return NextResponse.json({ messages: enriched });
    }

    // Attendee: fetch own messages with replies
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { effectiveUserId } = await resolveEffectiveUser(request, user.id);

    const { data: messages, error } = await admin
      .from("emergency_messages")
      .select(
        `*,
         replies:emergency_replies(
           *,
           reply_sender:profiles!sender_id(id, display_name, first_name, last_name, email, is_super_admin)
         )`,
      )
      .eq("event_id", eventId)
      .eq("user_id", effectiveUserId)
      .order("created_at", { ascending: false })
      .order("created_at", { referencedTable: "emergency_replies", ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const replySenderIds = [
      ...new Set(
        (messages ?? []).flatMap((m: any) =>
          (m.replies ?? []).map((r: any) => r.reply_sender?.id).filter(Boolean),
        ),
      ),
    ];

    const { data: replySenderMemberships } =
      replySenderIds.length > 0
        ? await admin
            .from("event_memberships")
            .select("user_id, role")
            .eq("event_id", eventId)
            .in("user_id", replySenderIds)
        : { data: [] };

    const membershipRoleMap = new Map(
      (replySenderMemberships ?? []).map((m) => [m.user_id, m.role]),
    );

    const enriched = (messages ?? []).map((m: any) => ({
      ...m,
      replies: (m.replies ?? []).map((r: any) => {
        const rs = r.reply_sender;
        return {
          ...r,
          reply_sender: rs
            ? {
                display_name: rs.display_name,
                first_name: rs.first_name,
                last_name: rs.last_name,
                email: rs.email,
                role:
                  membershipRoleMap.get(rs.id) ??
                  (rs.is_super_admin ? "admin" : "attendee"),
              }
            : undefined,
        };
      }),
    }));

    return NextResponse.json({ messages: enriched });
  });
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/emergency/messages",
    "POST",
    async () => {
      const rlKey = getRateLimitKey(request) + ":emergency-messages";
      const rl = rateLimit(rlKey, 10, 60_000);
      if (!rl.success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 },
        );
      }

      const eventId = getEventId(request);
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { isSimulating } = await resolveEffectiveUser(request, user.id);
      const blocked = blockSimulatedWrite(isSimulating);
      if (blocked) return blocked;

      const body = await safeParseBody(request);
      if (body instanceof NextResponse) return body;
      const message = (body.message || "").trim();

      if (!message) {
        return NextResponse.json(
          { error: "Message is required" },
          { status: 400 },
        );
      }

      if (message.length > 1000) {
        return NextResponse.json(
          { error: "Message must be 1000 characters or less" },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from("emergency_messages")
        .insert({ user_id: user.id, message, event_id: eventId })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      telemetry.trackEmergencyMessage("create", { userId: user.id });

      // Send push notification to all admins (fire-and-forget)
      const preview =
        message.length > 80 ? message.slice(0, 80) + "\u2026" : message;
      const { data: eventRow } = await supabase
        .from("events")
        .select("logo_url")
        .eq("id", eventId)
        .single();
      sendPushToAdmins({
        title: "New Attendee Message",
        body: preview,
        url: "/admin/emergency",
        icon: eventRow?.logo_url || undefined,
      }, eventId).catch((err) => console.error("Failed to push emergency notification to admins:", err));

      return NextResponse.json(data, { status: 201 });
    },
  );
}
