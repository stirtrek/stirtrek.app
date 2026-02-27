"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Sponsor } from "@/lib/types";

export function SponsorCompanySelector() {
  const { profile, refreshProfile } = useAuth();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loadingSponsors, setLoadingSponsors] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/sponsors")
      .then((res) => res.json())
      .then((data) => setSponsors(data.sponsors ?? []))
      .catch(() => toast.error("Failed to load sponsors"))
      .finally(() => setLoadingSponsors(false));
  }, []);

  const handleChange = async (sponsorId: string) => {
    if (sponsorId === profile?.sponsor_id) return;
    setSaving(true);

    const res = await fetch("/api/sponsor/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsor_id: sponsorId }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to update company");
      setSaving(false);
      return;
    }

    await refreshProfile();
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
            value={profile?.sponsor_id ?? undefined}
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
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}
