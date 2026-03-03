"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Sponsor } from "@/lib/types";

const NOT_A_SPONSOR = "__not_a_sponsor__";

export function SponsorCompanySelector() {
  const { user, refreshProfile } = useAuth();
  const { eventId, eventSlug } = useEvent();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loadingSponsors, setLoadingSponsors] = useState(true);
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/${eventSlug}/api/sponsors`)
      .then((res) => res.json())
      .then((data) => setSponsors(data.sponsors ?? []))
      .catch(() => toast.error("Failed to load sponsors"))
      .finally(() => setLoadingSponsors(false));
  }, [eventSlug]);

  useEffect(() => {
    if (!user || !eventId) return;
    const supabase = createClient(eventId);
    supabase
      .from("event_memberships")
      .select("sponsor_id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setSponsorId(data?.sponsor_id ?? null);
      });
  }, [user, eventId]);

  const handleChange = async (value: string) => {
    if (value === NOT_A_SPONSOR) {
      if (!confirm("Remove your sponsor access? You'll need the access code to reactivate.")) {
        return;
      }
      setSaving(true);
      const res = await fetch(`/${eventSlug}/api/sponsor/deactivate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to remove sponsor status");
        setSaving(false);
        return;
      }
      await refreshProfile();
      setSponsorId(null);
      toast.success("Sponsor access removed");
      setSaving(false);
      return;
    }

    if (value === sponsorId) return;
    setSaving(true);

    const res = await fetch(`/${eventSlug}/api/sponsor/company`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsor_id: value }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to update company");
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSponsorId(value);
    toast.success("Company updated");
    setSaving(false);
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Your Sponsor Company</p>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Wrong company? Just select the correct one below.
        </p>
        {loadingSponsors ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <Select
            value={sponsorId ?? undefined}
            onValueChange={handleChange}
            disabled={saving}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select your company" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-60">
              {sponsors.map((sponsor) => (
                <SelectItem key={sponsor.id} value={sponsor.id}>
                  {sponsor.name}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value={NOT_A_SPONSOR} className="text-muted-foreground">
                I&apos;m not a sponsor
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}
