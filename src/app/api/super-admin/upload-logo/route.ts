import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin, isErrorResponse } from "@/lib/events/api-helpers";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (isErrorResponse(auth)) return auth;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const slug = formData.get("slug") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 2MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "png";
  const fileName = `${slug || "event"}-${Date.now()}.${ext}`;

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from("event-logos")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage
    .from("event-logos")
    .getPublicUrl(fileName);

  return NextResponse.json({ url: urlData.publicUrl });
}
