import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEvent } from "@/lib/events/resolve";
import { notFound } from "next/navigation";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import type { SessionWithDetails } from "@/lib/types";

export const metadata = {
  title: "Browse Schedule",
};

export default async function BrowseSchedulePage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const event = await resolveEvent(eventSlug);
  if (!event) notFound();

  const supabase = createAdminClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      `
      *,
      room:rooms(*),
      speakers:session_speakers(speaker:speakers(*)),
      categories:session_categories(category_item:category_items(*))
    `
    )
    .eq("event_id", event.id)
    .order("starts_at", { ascending: true });

  const transformedSessions: SessionWithDetails[] = (sessions || []).map(
    (s: Record<string, unknown>) => {
      const { speakers: speakerJoin, categories: categoryJoin, room, ...session } = s;
      return {
        ...session,
        room: room || null,
        speakers: (speakerJoin as { speaker: unknown }[] || [])
          .map((j) => j.speaker)
          .filter(Boolean),
        categories: (categoryJoin as { category_item: unknown }[] || [])
          .map((j) => j.category_item)
          .filter(Boolean),
      } as SessionWithDetails;
    }
  );

  return (
    <Suspense>
      <ScheduleGrid sessions={transformedSessions} />
    </Suspense>
  );
}
