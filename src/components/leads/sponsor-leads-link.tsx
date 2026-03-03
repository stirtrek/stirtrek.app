"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScanLine } from "lucide-react";

export function SponsorLeadsLink() {
  const { user } = useAuth();
  const { eventPath, eventId } = useEvent();
  const [isSponsor, setIsSponsor] = useState(false);
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  useEffect(() => {
    if (!user || !eventId) return;
    supabase
      .from("event_memberships")
      .select("is_sponsor")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setIsSponsor(data.is_sponsor);
      });
  }, [user, eventId, supabase]);

  if (!isSponsor) return null;

  return (
    <Link href={eventPath("/leads")}>
      <Card className="transition-colors hover:bg-accent">
        <CardHeader className="flex flex-row items-center gap-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ScanLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Sponsor Leads</CardTitle>
            <CardDescription>
              Scan badges and manage your leads
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
