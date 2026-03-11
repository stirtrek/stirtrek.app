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
      const { data: messages, error } = await admin
        .from("emergency_messages")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const messageIds = (messages ?? []).map((m) => m.id);
      const userIds = [...new Set((messages ?? []).map((m) => m.user_id))];

      const [{ data: profiles }, { data: replies }] = await Promise.all([
        admin
          .from("profiles")
          .select("id, display_name, first_name, last_name, email")
          .in("id", userIds.length > 0 ? userIds : ["no-match"]),
        admin
          .from("emergency_replies")
          .select("*")
          .in("message_id", messageIds.length > 0 ? messageIds : ["no-match"])
          .order("created_at", { ascending: true }),
      ]);

      const replySenderIds = [
        ...new Set((replies ?? []).map((r) => r.sender_id)),
      ];
      const [{ data: replySenderProfiles }, { data: replySenderMemberships }] =
        replySenderIds.length > 0
          ? await Promise.all([
              admin
                .from("profiles")
                .select("id, display_name, first_name, last_name, email, is_super_admin")
                .in("id", replySenderIds),
              admin
                .from("event_memberships")
                .select("user_id, role")
                .eq("event_id", eventId)
                .in("user_id", replySenderIds),
            ])
          : [{ data: [] }, { data: [] }];

      const membershipRoleMap = new Map(
        (replySenderMemberships ?? []).map((m) => [m.user_id, m.role]),
      );

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const replySenderMap = new Map(
        (replySenderProfiles ?? []).map((p) => [
          p.id,
          {
            display_name: p.display_name,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            role: membershipRoleMap.get(p.id) ?? (p.is_super_admin ? "admin" : "attendee"),
          },
        ]),
      );

      const enriched = (messages ?? []).map((m) => {
        const sender = profileMap.get(m.user_id);
        const messageReplies = (replies ?? [])
          .filter((r) => r.message_id === m.id)
          .map((r) => ({
            ...r,
            reply_sender: replySenderMap.get(r.sender_id) ?? undefined,
          }));

        return {
          ...m,
          sender: sender
            ? {
                display_name: sender.display_name,
                first_name: sender.first_name,
                last_name: sender.last_name,
                email: sender.email,
              }
            : undefined,
          replies: messageReplies,
        };
      });

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
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", effectiveUserId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const messageIds = (messages ?? []).map((m) => m.id);

    const { data: replies } =
      messageIds.length > 0
        ? await admin
            .from("emergency_replies")
            .select("*")
            .in("message_id", messageIds)
            .order("created_at", { ascending: true })
        : { data: [] };

    const replySenderIds = [
      ...new Set((replies ?? []).map((r) => r.sender_id)),
    ];
    const [{ data: replySenderProfiles }, { data: replySenderMemberships }] =
      replySenderIds.length > 0
        ? await Promise.all([
            admin
              .from("profiles")
              .select("id, display_name, first_name, last_name, email, is_super_admin")
              .in("id", replySenderIds),
            admin
              .from("event_memberships")
              .select("user_id, role")
              .eq("event_id", eventId)
              .in("user_id", replySenderIds),
          ])
        : [{ data: [] }, { data: [] }];

    const membershipRoleMap = new Map(
      (replySenderMemberships ?? []).map((m) => [m.user_id, m.role]),
    );

    const replySenderMap = new Map(
      (replySenderProfiles ?? []).map((p) => [
        p.id,
        {
          display_name: p.display_name,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          role: membershipRoleMap.get(p.id) ?? (p.is_super_admin ? "admin" : "attendee"),
        },
      ]),
    );

    const enriched = (messages ?? []).map((m) => ({
      ...m,
      replies: (replies ?? [])
        .filter((r) => r.message_id === m.id)
        .map((r) => ({
          ...r,
          reply_sender: replySenderMap.get(r.sender_id) ?? undefined,
        })),
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
