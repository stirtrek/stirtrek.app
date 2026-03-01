import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";

export async function GET() {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/simulated-time",
    "GET",
    async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "simulated_time")
        .single();

      if (error) {
        return NextResponse.json({ simulatedTime: null });
      }

      // value is stored as a JSON string when active, or JSON false when cleared
      const raw = data.value;
      const simulatedTime = typeof raw === "string" ? raw : null;
      return NextResponse.json({ simulatedTime });
    },
  );
}

export async function PUT(request: Request) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/simulated-time",
    "PUT",
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

      const body = await request.json();
      const time: string | null = body.time ?? null;

      // Store the time string when active, or JSON false when clearing.
      // We avoid storing JS null because Supabase interprets it as SQL NULL,
      // which violates the JSONB NOT NULL constraint on app_settings.value.
      const dbValue = time ?? false;

      const admin = createAdminClient();
      const { error } = await admin
        .from("app_settings")
        .update({ value: dbValue, updated_by: user.id })
        .eq("key", "simulated_time");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ simulatedTime: time });
    },
  );
}
