import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncSponsorsFromFeed } from "@/lib/sponsors/sync";
import { getTelemetryService } from "@/lib/telemetry/service";

export async function POST() {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/sponsors/sync",
    "POST",
    async () => {
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

      const result = await syncSponsorsFromFeed();

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ synced: result.synced });
    },
  );
}
