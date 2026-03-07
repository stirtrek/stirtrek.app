import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEvent } from "@/lib/events/resolve";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RoomScheduleList } from "./room-schedule-list";
import type { SessionWithDetails } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventSlug: string; roomId: string }>;
}) {
  const { eventSlug, roomId } = await params;
  const event = await resolveEvent(eventSlug);
  if (!event) return { title: "Room" };

  const supabase = createAdminClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("name")
    .eq("id", Number(roomId))
    .eq("event_id", event.id)
    .single();

  return { title: room?.name || "Room" };
}

export default async function RoomSchedulePage({
  params,
}: {
  params: Promise<{ eventSlug: string; roomId: string }>;
}) {
  const { eventSlug, roomId } = await params;
  const event = await resolveEvent(eventSlug);
  if (!event) notFound();

  const supabase = createAdminClient();

  const [{ data: room }, { data: sessions }] = await Promise.all([
    supabase
      .from("rooms")
      .select("*")
      .eq("id", Number(roomId))
      .eq("event_id", event.id)
      .single(),
    supabase
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
      .eq("room_id", Number(roomId))
      .eq("is_service_session", false)
      .order("starts_at", { ascending: true }),
  ]);

  if (!room) notFound();

  const transformedSessions: SessionWithDetails[] = (sessions || []).map(
    (s: Record<string, unknown>) => {
      const { speakers: speakerJoin, categories: categoryJoin, room: r, ...session } = s;
      return {
        ...session,
        room: r || null,
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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href={`/${eventSlug}/schedule`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Schedule
        </Link>
      </div>
      <h1 className="text-xl font-bold">{room.name}</h1>
      <RoomScheduleList sessions={transformedSessions} />
    </div>
  );
}
