"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { EventForm } from "@/components/super-admin/event-form";
import { Button } from "@/components/ui/button";
import type { Event } from "@/lib/types";
import { toast } from "sonner";

export default function EditEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchEvent = useCallback(async () => {
    const res = await fetch(`/api/super-admin/events/${eventId}`);
    if (res.ok) {
      setEvent(await res.json());
    } else {
      toast.error("Event not found");
      router.push("/super-admin");
    }
    setLoading(false);
  }, [eventId, router]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  async function handleSubmit(data: Partial<Event>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to update event");
        return;
      }

      const updated = await res.json();
      setEvent(updated);
      toast.success("Event updated");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        Loading event...
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/super-admin"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">{event.name}</h1>
        </div>
        <Link href={`/${event.slug}/admin`} target="_blank">
          <Button variant="outline" size="sm">
            Event Admin
            <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
      <EventForm event={event} onSubmit={handleSubmit} saving={saving} />
    </div>
  );
}
