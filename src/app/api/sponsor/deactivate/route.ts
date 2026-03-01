import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";

export async function POST() {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/sponsor/deactivate",
    "POST",
    async () => {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { error } = await supabase
        .from("profiles")
        .update({ is_sponsor: false, sponsor_id: null })
        .eq("id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      telemetry.trackAuthEvent("sponsor_deactivate", { userId: user.id });

      return NextResponse.json({ success: true });
    },
  );
}
