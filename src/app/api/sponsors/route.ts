import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";

export async function GET() {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/sponsors", "GET", async () => {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: sponsors, error } = await supabase
      .from("sponsors")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sponsors: sponsors ?? [] });
  });
}
