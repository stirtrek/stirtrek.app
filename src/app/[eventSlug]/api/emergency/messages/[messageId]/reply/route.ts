import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, sendPushToAdmins } from "@/lib/push";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
  resolveEffectiveUser,
  blockSimulatedWrite,
} from "@/lib/events/api-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/emergency/messages/[messageId]/reply",
    "POST",
    async () => {
      const eventId = getEventId(request);
      const { messageId } = await params;

      // Check if user is an event admin/staff
      const adminAuth = await requireEventAdmin(eventId);
      const isAdmin = !isErrorResponse(adminAuth);

      // If not admin, must be authenticated to check ownership
      if (!isAdmin) {
        if (adminAuth.status === 401) return adminAuth;
      }

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

      // Use admin client for lookup — auth is already verified by
      // requireEventAdmin above, and the user-scoped client's RLS
      // doesn't account for super-admins without an event_memberships row.
      const admin = createAdminClient();
      const { data: message } = await admin
        .from("emergency_messages")
        .select("id, user_id")
        .eq("id", messageId)
        .eq("event_id", eventId)
        .single();

      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 },
        );
      }

      const isOwner = message.user_id === user.id;

      if (!isAdmin && !isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await safeParseBody(request);
      if (body instanceof NextResponse) return body;
      const reply = (body.reply || "").trim();

      if (!reply) {
        return NextResponse.json(
          { error: "Reply is required" },
          { status: 400 },
        );
      }

      if (reply.length > 1000) {
        return NextResponse.json(
          { error: "Reply must be 1000 characters or less" },
          { status: 400 },
        );
      }

      const { data, error } = await admin
        .from("emergency_replies")
        .insert({
          message_id: messageId,
          sender_id: user.id,
          reply,
          event_id: eventId,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      telemetry.trackEmergencyMessage("reply", { messageId, userId: user.id });

      // Send push notification (fire-and-forget)
      const preview = reply.length > 80 ? reply.slice(0, 80) + "\u2026" : reply;
      const { data: eventRow } = await admin
        .from("events")
        .select("logo_url")
        .eq("id", eventId)
        .single();
      const eventIcon = eventRow?.logo_url || undefined;
      if (isAdmin) {
        // Admin replied → notify the message owner
        sendPushToUser(message.user_id, {
          title: "Staff replied to your message",
          body: preview,
          url: "/emergency",
          icon: eventIcon,
        }, eventId).catch((err) => console.error("Failed to push reply notification to user:", err));
      } else {
        // User added context → notify admins
        sendPushToAdmins({
          title: "Attendee update",
          body: preview,
          url: "/admin/emergency",
          icon: eventIcon,
        }, eventId).catch((err) => console.error("Failed to push update notification to admins:", err));
      }

      return NextResponse.json(data, { status: 201 });
    },
  );
}
