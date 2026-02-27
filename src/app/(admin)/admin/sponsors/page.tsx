"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SponsorAccount {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  sponsor_id: string | null;
  sponsor_name: string | null;
  sponsor_tier: string | null;
  lead_count: number;
}

interface SponsorOption {
  id: string;
  name: string;
  tier: string;
}

export default function AdminSponsorsPage() {
  const [accounts, setAccounts] = useState<SponsorAccount[]>([]);
  const [sponsors, setSponsors] = useState<SponsorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sponsor-accounts");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
      setSponsors(data.sponsors ?? []);
    } catch {
      toast.error("Failed to load sponsor accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = async (profileId: string, sponsorId: string) => {
    setUpdating(profileId);
    try {
      const res = await fetch("/api/admin/sponsor-accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          sponsor_id: sponsorId === "unassigned" ? null : sponsorId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Update failed");
      }

      toast.success("Sponsor assignment updated");
      await fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update assignment"
      );
    } finally {
      setUpdating(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sponsors/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(`Synced ${data.synced} sponsors from stirtrek.com`);
      await fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to sync sponsors"
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = (sponsorId: string, sponsorName: string) => {
    window.open(
      `/api/admin/sponsor-accounts/export?sponsor_id=${sponsorId}`,
      "_blank"
    );
    toast.success(`Exporting leads for ${sponsorName}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const unassignedCount = accounts.filter((a) => !a.sponsor_id).length;
  const totalLeads = accounts.reduce((sum, a) => sum + a.lead_count, 0);

  // Aggregate leads by company for the summary
  const companyStats: Record<
    string,
    { name: string; tier: string; leads: number; reps: number }
  > = {};
  for (const account of accounts) {
    if (account.sponsor_id && account.sponsor_name) {
      if (!companyStats[account.sponsor_id]) {
        companyStats[account.sponsor_id] = {
          name: account.sponsor_name,
          tier: account.sponsor_tier || "",
          leads: 0,
          reps: 0,
        };
      }
      companyStats[account.sponsor_id].leads += account.lead_count;
      companyStats[account.sponsor_id].reps += 1;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sponsor Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
          {accounts.length} sponsor accounts &middot; {totalLeads} total leads
          {unassignedCount > 0 && (
            <span className="text-yellow-500">
              {" "}
              &middot; {unassignedCount} unassigned
            </span>
          )}
        </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Sponsors
            </>
          )}
        </Button>
      </div>

      {/* Company summary with export */}
      {Object.keys(companyStats).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Leads by Company</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(companyStats)
                .sort((a, b) => b[1].leads - a[1].leads)
                .map(([id, stats]) => (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">{stats.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stats.reps} rep{stats.reps !== 1 ? "s" : ""} &middot;{" "}
                          {stats.leads} lead{stats.leads !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Badge variant="secondary">{stats.tier}</Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(id, stats.name)}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      CSV
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Account Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sponsor accounts yet.
            </p>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {account.first_name || account.last_name
                          ? `${account.first_name || ""} ${account.last_name || ""}`.trim()
                          : account.email}
                      </p>
                      {!account.sponsor_id && (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.email} &middot; {account.lead_count} lead
                      {account.lead_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Select
                      value={account.sponsor_id || "unassigned"}
                      onValueChange={(val) => handleAssign(account.id, val)}
                      disabled={updating === account.id}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {sponsors.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
