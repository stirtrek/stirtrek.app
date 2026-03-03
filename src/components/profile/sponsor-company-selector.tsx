"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface SponsorCompanySelectorProps {
  initialSponsorId: string | null;
}

export function SponsorCompanySelector({ initialSponsorId }: SponsorCompanySelectorProps) {
  const { refreshProfile } = useAuth();
  const { eventSlug } = useEvent();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loadingSponsors, setLoadingSponsors] = useState(true);
  const [sponsorId, setSponsorId] = useState<string | null>(initialSponsorId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSponsorId(initialSponsorId);
  }, [initialSponsorId]);

  useEffect(() => {
    fetch(`/${eventSlug}/api/sponsors`)
      .then((res) => res.json())
      .then((data) => setSponsors(data.sponsors ?? []))
      .catch(() => toast.error("Failed to load sponsors"))
      .finally(() => setLoadingSponsors(false));
  }, [eventSlug]);

  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = async (value: string) => {
    if (value === NOT_A_SPONSOR) {
      setShowConfirm(true);
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

  const handleDeactivate = async () => {
    setShowConfirm(false);
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
  };

  return (
    <>
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

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove Sponsor Access?</DialogTitle>
            <DialogDescription>
              You&apos;ll need the sponsor access code to reactivate. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeactivate}>
              Remove Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
