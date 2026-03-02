import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";

export async function POST(request: Request) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/profile/complete", "POST", async () => {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
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
      console.error("Profile complete update failed:", error.message, { userId: user.id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      console.error("Profile complete update matched 0 rows", { userId: user.id });
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    telemetry.trackAuthEvent("profile_complete", { userId: user.id });

    return NextResponse.json({ success: true });
  });
}
