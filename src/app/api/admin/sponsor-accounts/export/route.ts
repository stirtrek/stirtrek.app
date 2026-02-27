import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const sponsorId = searchParams.get("sponsor_id");

  if (!sponsorId) {
    return NextResponse.json(
      { error: "sponsor_id is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Get the sponsor name for the filename
  const { data: sponsor } = await admin
    .from("sponsors")
    .select("name")
    .eq("id", sponsorId)
    .single();

  if (!sponsor) {
    return NextResponse.json(
      { error: "Sponsor not found" },
      { status: 404 }
    );
  }

  // Find all profiles assigned to this sponsor company
  const { data: sponsorProfiles } = await admin
    .from("profiles")
    .select("id")
    .eq("is_sponsor", true)
    .eq("sponsor_id", sponsorId);

  const profileIds = (sponsorProfiles ?? []).map((p) => p.id);

  if (profileIds.length === 0) {
    const csv = "Email,First Name,Last Name,Scanned At,Scanned By,Notes";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${escapeCsvField(sponsor.name)}-leads.csv"`,
      },
    });
  }

  // Get all leads from all reps of this company
  const { data: leads, error } = await admin
    .from("leads")
    .select(
      "attendee_email, attendee_first_name, attendee_last_name, scanned_at, notes, sponsor_profile_id, profiles!sponsor_profile_id(email)"
    )
    .in("sponsor_profile_id", profileIds)
    .order("scanned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = "Email,First Name,Last Name,Scanned At,Scanned By,Notes";
  const rows = (leads ?? []).map((lead) => {
    const scannedBy =
      (lead.profiles as unknown as { email: string })?.email ?? "";
    return [
      escapeCsvField(lead.attendee_email),
      escapeCsvField(lead.attendee_first_name || ""),
      escapeCsvField(lead.attendee_last_name || ""),
      escapeCsvField(new Date(lead.scanned_at).toISOString()),
      escapeCsvField(scannedBy),
      escapeCsvField(lead.notes || ""),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const safeName = sponsor.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${safeName}-leads-${date}.csv"`,
    },
  });
}
