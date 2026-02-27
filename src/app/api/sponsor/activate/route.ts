import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
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

  const { error } = await supabase
    .from("profiles")
    .update({ is_sponsor: true })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
