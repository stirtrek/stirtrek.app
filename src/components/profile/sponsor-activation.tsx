"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { Sponsor } from "@/lib/types";

export function SponsorActivation() {
  const { refreshProfile } = useAuth();
  const { eventSlug } = useEvent();
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [sponsorId, setSponsorId] = useState<string | undefined>(undefined);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loadingSponsors, setLoadingSponsors] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded || sponsors.length > 0) return;

    setLoadingSponsors(true);
    fetch(`/${eventSlug}/api/sponsors`)
      .then((res) => res.json())
      .then((data) => setSponsors(data.sponsors ?? []))
      .catch(() => toast.error("Failed to load sponsors"))
      .finally(() => setLoadingSponsors(false));
  }, [expanded, sponsors.length]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/${eventSlug}/api/sponsor/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, sponsor_id: sponsorId }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Activation failed");
      setLoading(false);
      return;
    }

    await refreshProfile();
    toast.success("Sponsor access activated!");
    setLoading(false);
  };

  return (
    <Card>
      <CardContent className="py-4">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          Are you a sponsor?
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <form onSubmit={handleActivate} className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Select your company and enter the access code provided by the Stir
              Trek team to unlock badge scanning.
            </p>
            <Select
              value={sponsorId}
              onValueChange={setSponsorId}
              disabled={loading || loadingSponsors}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    loadingSponsors ? "Loading sponsors..." : "Select your company"
                  }
                />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-60">
                {sponsors.map((sponsor) => (
                  <SelectItem key={sponsor.id} value={sponsor.id}>
                    {sponsor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="text"
              placeholder="Access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !sponsorId || !code}
              className="w-full"
              size="sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                "Activate"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
