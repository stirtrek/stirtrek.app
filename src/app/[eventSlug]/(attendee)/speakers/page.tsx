import { createAdminClient } from "@/lib/supabase/admin";
import { SpeakerCard } from "@/components/speakers/speaker-card";
import type { Speaker } from "@/lib/types";

export const metadata = {
  title: "Speakers",
};

export default async function SpeakersPage() {
  const supabase = createAdminClient();

  const { data: speakers } = await supabase
    .from("speakers")
    .select("*")
    .order("full_name", { ascending: true });

  if (!speakers || speakers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Speakers</h1>
        <p className="text-muted-foreground">
          Speaker profiles will appear here once synced from Sessionize.
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
