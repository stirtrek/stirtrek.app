import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export async function GET() {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/leads/export", "GET", async () => {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_sponsor")
      .eq("id", user.id)
      .single();

    if (!profile?.is_sponsor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("sponsor_profile_id", user.id)
      .order("scanned_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const header = "Email,First Name,Last Name,Scanned At,Notes";
    const rows = (leads || []).map((lead) =>
      [
        escapeCsvField(lead.attendee_email),
        escapeCsvField(lead.attendee_first_name || ""),
        escapeCsvField(lead.attendee_last_name || ""),
        escapeCsvField(new Date(lead.scanned_at).toISOString()),
        escapeCsvField(lead.notes || ""),
      ].join(","),
    );

    const csv = [header, ...rows].join("\n");
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="stirtrek-leads-${date}.csv"`,
      },
    });
  });
}
