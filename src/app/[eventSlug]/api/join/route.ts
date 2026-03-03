import { NextRequest, NextResponse } from "next/server";
import { resolveEvent, ensureEventMembership } from "@/lib/events/resolve";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> },
) {
  const { eventSlug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await resolveEvent(eventSlug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await ensureEventMembership(event.id, user.id);

  return NextResponse.json({ ok: true });
}
