import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveEvent, ensureEventMembership } from "@/lib/events/resolve";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventSlug: string }> },
) {
  const { eventSlug } = await params;
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const redirect = searchParams.get("redirect") || `/${eventSlug}/schedule`;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Auto-join the user to this event if they aren't already a member
      const event = await resolveEvent(eventSlug);
      const { data: { user } } = await supabase.auth.getUser();
      if (event && user) {
        await ensureEventMembership(event.id, user.id);
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/${eventSlug}/login?error=auth`);
}
