import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";

export async function PATCH(request: Request) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/emergency/replies/mark-read",
    "PATCH",
    async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = await request.json();
      const replyIds: string[] = body.reply_ids;

      if (!Array.isArray(replyIds) || replyIds.length === 0) {
        return NextResponse.json(
          { error: "reply_ids array is required" },
          { status: 400 },
        );
      }

      // RLS ensures users can only update replies to their own messages
      const { error } = await supabase
        .from("emergency_replies")
        .update({ is_read: true })
        .in("id", replyIds);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    },
  );
}
