import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEvent } from "@/lib/events/resolve";
import { notFound } from "next/navigation";
import { SpeakerCard } from "@/components/speakers/speaker-card";
import type { Speaker } from "@/lib/types";

export const metadata = {
  title: "Speakers",
};

export default async function SpeakersPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const event = await resolveEvent(eventSlug);
  if (!event) notFound();

  const supabase = createAdminClient();

  const { data: speakers } = await supabase
    .from("speakers")
    .select("*")
    .eq("event_id", event.id)
    .order("full_name", { ascending: true });

  if (!speakers || speakers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Speakers</h1>
        <p className="text-muted-foreground">
          No speaker information is available for this event yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Speakers</h1>
      <p className="text-sm text-muted-foreground">
        {speakers.length} speakers
      </p>
      <div className="flex flex-col gap-4">
        {(speakers as Speaker[]).map((speaker) => (
          <SpeakerCard key={speaker.id} speaker={speaker} />
        ))}
      </div>
    </div>
  );
}
