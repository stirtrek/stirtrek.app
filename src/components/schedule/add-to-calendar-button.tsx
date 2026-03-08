"use client";

import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateICS } from "@/lib/ical";
import { useEvent } from "@/providers/event-provider";
import type { SessionWithDetails } from "@/lib/types";

interface AddToCalendarButtonProps {
  sessions: SessionWithDetails[];
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function AddToCalendarButton({
  sessions,
  label = "Add to Calendar",
  variant = "outline",
  size = "sm",
}: AddToCalendarButtonProps) {
  const { event } = useEvent();

  const handleDownload = () => {
    const ics = generateICS(sessions, event.name);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      sessions.length === 1
        ? `${sessions[0].title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`
        : `${event.name.replace(/[^a-zA-Z0-9]/g, "_")}_schedule.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Don't render if no sessions have valid times
  if (!sessions.some((s) => s.starts_at && s.ends_at)) return null;

  return (
    <Button variant={variant} size={size} onClick={handleDownload}>
      <CalendarPlus className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
