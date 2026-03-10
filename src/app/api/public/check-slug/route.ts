import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("events")
    .select("id")
    .eq("slug", slug)
    .single();

  return NextResponse.json({ available: !existing });
}
