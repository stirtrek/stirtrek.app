import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";
import { safeParseBody, resolveEffectiveUser, blockSimulatedWrite } from "@/lib/events/api-helpers";

export async function PUT(request: Request) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/profile", "PUT", async () => {
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
    const firstName = (body.first_name || "").trim();
    const lastName = (body.last_name || "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  });
}
