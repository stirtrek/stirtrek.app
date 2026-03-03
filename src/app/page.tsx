import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Root page: redirects to the default active event.
 * When multiple events exist, this could become an event directory.
 */
export default async function RootPage() {
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("events")
    .select("slug")
    .eq("is_active", true)
    .order("event_date", { ascending: true })
    .limit(1);

  const defaultSlug = events?.[0]?.slug ?? "stirtrek";
  redirect(`/${defaultSlug}`);
}
