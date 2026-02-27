import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqual } from "crypto";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const code = (body.code || "").trim();
  const sponsorId = (body.sponsor_id || "").trim();

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  if (!sponsorId) {
    return NextResponse.json(
      { error: "Please select your sponsor company" },
      { status: 400 }
    );
  }

  const expectedCode = process.env.SPONSOR_ACCESS_CODE;
  if (!expectedCode) {
    return NextResponse.json(
      { error: "Sponsor activation is not configured" },
      { status: 503 }
    );
  }

  // Constant-time comparison to prevent timing attacks
  const codeBuffer = Buffer.from(code.padEnd(256, "\0"));
  const expectedBuffer = Buffer.from(expectedCode.padEnd(256, "\0"));
  const isValid = timingSafeEqual(codeBuffer, expectedBuffer);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid access code" }, { status: 403 });
  }

  // Validate that the selected sponsor exists and is active
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
    .update({ is_sponsor: true, sponsor_id: sponsorId })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
