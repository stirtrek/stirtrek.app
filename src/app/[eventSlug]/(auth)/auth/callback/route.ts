import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveEvent, ensureEventMembership } from "@/lib/events/resolve";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventSlug: string }> },
) {
  const { eventSlug } = await params;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || `/${eventSlug}/schedule`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

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

  // Return the user to login with an error
  return NextResponse.redirect(`${origin}/${eventSlug}/login?error=auth`);
}
