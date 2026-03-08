import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const eventId = getEventId(request);
  const auth = await requireEventAdmin(eventId);
  if (isErrorResponse(auth)) return auth;

  const admin = createAdminClient();

  const { data: items } = await admin
    .from("category_items")
    .select("id, name, category_id, categories(title)")
    .eq("event_id", eventId)
    .order("name", { ascending: true });

  const result = (items ?? []).map((item) => {
    const cat = item.categories as unknown as { title: string } | null;
    return {
      id: item.id,
      name: item.name,
      category_title: cat?.title ?? "",
    };
  });

  return NextResponse.json({ items: result });
}
