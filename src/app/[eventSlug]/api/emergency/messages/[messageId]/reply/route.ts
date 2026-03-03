import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser, sendPushToAdmins } from "@/lib/push";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
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

      // Verify the message exists and the user is either admin/staff or the message owner
      const { data: message } = await supabase
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

      const body = await request.json();
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

      const { data, error } = await supabase
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
      if (isAdmin) {
        // Admin replied → notify the message owner
        sendPushToUser(message.user_id, {
          title: "Staff replied to your message",
          body: preview,
          url: "/emergency",
        }, eventId).catch(() => {});
      } else {
        // User added context → notify admins
        sendPushToAdmins({
          title: "Attendee update",
          body: preview,
          url: "/admin/emergency",
        }, eventId).catch(() => {});
      }

      return NextResponse.json(data, { status: 201 });
    },
  );
}
