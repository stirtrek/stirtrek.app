import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: Request) {
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

  const body = await request.json();
  const sponsorId = (body.sponsor_id || "").trim();

  if (!sponsorId) {
    return NextResponse.json(
      { error: "Please select a company" },
      { status: 400 }
    );
  }

  // Validate the sponsor exists and is active
  const admin = createAdminClient();
  const { data: sponsor } = await admin
    .from("sponsors")
    .select("id")
    .eq("id", sponsorId)
    .eq("is_active", true)
    .single();

  if (!sponsor) {
    return NextResponse.json(
      { error: "Invalid sponsor selection" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ sponsor_id: sponsorId })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
