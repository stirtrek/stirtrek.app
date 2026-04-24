import { Card, CardContent } from "@/components/ui/card";
import { Megaphone } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEvent } from "@/lib/events/resolve";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Announcements",
};

// Revalidate at most every 30s — new announcements are rare and can tolerate
// a short cache window in exchange for offloading 1000+ concurrent fetches.
export const revalidate = 30;

interface SentAnnouncement {
  id: string;
  message: string;
  sent_at: string;
}

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const event = await resolveEvent(eventSlug);
  if (!event) notFound();

  const supabase = createAdminClient();

  const { data } = await supabase
    .from("announcements")
    .select("id, message, sent_at")
    .eq("event_id", event.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(100);

  const announcements = (data ?? []) as SentAnnouncement[];

  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Megaphone className="h-8 w-8" />
        <p className="text-sm">No announcements yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((a) => (
        <Card key={a.id} className="gap-0 py-0">
          <CardContent className="px-4 py-3">
            <p className="whitespace-pre-wrap text-sm">{a.message}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {new Date(a.sent_at).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
