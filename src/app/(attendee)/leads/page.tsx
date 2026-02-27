"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { LeadCard } from "@/components/leads/lead-card";
import { LeadNotesDialog } from "@/components/leads/lead-notes-dialog";
import { ScanLine, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Lead } from "@/lib/types";

export default function LeadsPage() {
  const { loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchLeads = useCallback(async () => {
    const res = await fetch("/api/leads");
    if (res.ok) {
      const data = await res.json();
      setLeads(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchLeads();
    }
  }, [authLoading, fetchLeads]);

  const handleTap = (lead: Lead) => {
    setSelectedLead(lead);
    setDialogOpen(true);
  };

  const handleNoteSaved = (updated: Lead) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === updated.id ? updated : l))
    );
    setSelectedLead(updated);
  };

  const handleExport = () => {
    window.location.href = "/api/leads/export";
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leads</h1>

      <div className="flex gap-2">
        <Link href="/leads/scan" className="flex-1">
          <Button className="w-full">
            <ScanLine className="mr-2 h-4 w-4" />
            Scan Badge
          </Button>
        </Link>
        {leads.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        )}
      </div>

      {leads.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">No leads scanned yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap &quot;Scan Badge&quot; to scan an attendee&apos;s QR code.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} scanned
          </p>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onTap={handleTap} />
          ))}
        </div>
      )}

      <LeadNotesDialog
        lead={selectedLead}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleNoteSaved}
      />
    </div>
  );
}
