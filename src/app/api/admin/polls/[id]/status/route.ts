import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";

async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "staff"].includes(profile.role)) return null;

  return user;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/polls/[id]/status",
    "PUT",
    async () => {
      const { id } = await params;
      const user = await checkAdmin();
      if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      const { status: newStatus } = body;

      const admin = createAdminClient();

      const { data: poll } = await admin
        .from("polls")
        .select("status")
        .eq("id", id)
        .single();

      if (!poll) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 });
      }

      const validTransitions: Record<string, string> = {
        draft: "active",
        active: "closed",
      };

      if (validTransitions[poll.status] !== newStatus) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${poll.status} to ${newStatus}`,
          },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = { status: newStatus };

      if (newStatus === "active") updateData.opened_at = now;
      if (newStatus === "closed") updateData.closed_at = now;

      const { error } = await admin
        .from("polls")
        .update(updateData)
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    },
  );
}
