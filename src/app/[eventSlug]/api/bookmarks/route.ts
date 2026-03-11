import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEventId,
  requireEventMember,
  isErrorResponse,
  resolveEffectiveUser,
} from "@/lib/events/api-helpers";

export async function GET(request: Request) {
  const eventId = getEventId(request);
  const auth = await requireEventMember(eventId);
  if (isErrorResponse(auth)) return auth;

  const { effectiveUserId } = await resolveEffectiveUser(
    request,
    auth.userId,
  );

  const admin = createAdminClient();
  const { data } = await admin
    .from("personal_schedule")
    .select("session_id")
    .eq("user_id", effectiveUserId)
    .eq("event_id", eventId);

  return NextResponse.json({
    session_ids: (data ?? []).map(
      (d: { session_id: string }) => d.session_id,
    ),
  });
}
