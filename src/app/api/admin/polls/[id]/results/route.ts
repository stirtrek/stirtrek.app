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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/polls/[id]/results",
    "GET",
    async () => {
      const { id } = await params;
      const user = await checkAdmin();
      if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const admin = createAdminClient();

      const { data: poll } = await admin
        .from("polls")
        .select("id, question, status, allow_multiple")
        .eq("id", id)
        .single();

      if (!poll) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 });
      }

      const { data: results, error } = await admin.rpc("get_poll_results", {
        p_poll_id: id,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { count } = await admin
        .from("poll_responses")
        .select("*", { count: "exact", head: true })
        .eq("poll_id", id);

      return NextResponse.json({
        poll,
        results: results ?? [],
        total_votes: count ?? 0,
      });
    },
  );
}
