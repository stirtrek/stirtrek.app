"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, Loader2 } from "lucide-react";
import { useEvent } from "@/providers/event-provider";

interface SentAnnouncement {
  id: string;
  message: string;
  sent_at: string;
}

export default function AnnouncementsPage() {
  const { eventSlug } = useEvent();
  const [announcements, setAnnouncements] = useState<SentAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    const res = await fetch(`/${eventSlug}/api/announcements`);
    if (res.ok) {
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
