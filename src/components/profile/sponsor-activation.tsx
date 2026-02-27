"use client";

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export function SponsorActivation() {
  const { refreshProfile } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/sponsor/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
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
              Enter the access code provided by the Stir Trek team to unlock
              badge scanning.
            </p>
            <Input
              type="text"
              placeholder="Access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              disabled={loading}
            />
            <Button type="submit" disabled={loading} className="w-full" size="sm">
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
