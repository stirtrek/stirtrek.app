import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";

const VALID_STATUSES = ["unresponded", "acknowledged", "closed"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/emergency/messages/[messageId]/status",
    "PATCH",
    async () => {
      const { messageId } = await params;
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || !["admin", "staff"].includes(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      const newStatus = body.status;

      if (!VALID_STATUSES.includes(newStatus)) {
        return NextResponse.json(
          {
            error:
              "Invalid status. Must be: unresponded, acknowledged, or closed",
          },
          { status: 400 },
        );
      }

      const { error } = await supabase
        .from("emergency_messages")
        .update({ status: newStatus })
        .eq("id", messageId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      telemetry.trackEmergencyMessage("status_change", {
        messageId,
        status: newStatus,
      });

      return NextResponse.json({ success: true });
    },
  );
}
