import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side sign-out. The browser-side `signOut()` from the AuthProvider
 * POSTs here, then hard-redirects. We do the actual cookie clearing on the
 * server so the response carries the cleared auth cookies — middleware on
 * the next request will see no user and route accordingly.
 */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
