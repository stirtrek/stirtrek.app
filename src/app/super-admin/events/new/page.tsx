"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EventForm } from "@/components/super-admin/event-form";
import type { Event } from "@/lib/types";
import { toast } from "sonner";

export default function NewEventPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(data: Partial<Event>) {
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create event");
        return;
      }

      toast.success("Event created");
      router.push("/super-admin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/super-admin"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Create Event</h1>
      </div>
      <EventForm onSubmit={handleSubmit} saving={saving} />
    </div>
  );
}
