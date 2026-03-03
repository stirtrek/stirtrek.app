"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { useEvent } from "@/providers/event-provider";
import type { Lead } from "@/lib/types";

interface LeadCardProps {
  lead: Lead;
  onTap: (lead: Lead) => void;
}

export function LeadCard({ lead, onTap }: LeadCardProps) {
  const { event } = useEvent();
  const name = [lead.attendee_first_name, lead.attendee_last_name]
    .filter(Boolean)
    .join(" ");

  const scannedAt = new Date(lead.scanned_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone,
  });

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent"
      onClick={() => onTap(lead)}
    >
      <CardContent className="flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {name || lead.attendee_email}
          </p>
          {name && (
            <p className="truncate text-sm text-muted-foreground">
              {lead.attendee_email}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{scannedAt}</p>
        </div>
        {lead.notes && (
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </CardContent>
    </Card>
  );
}
