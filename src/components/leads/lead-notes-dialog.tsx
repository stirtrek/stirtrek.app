"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Lead } from "@/lib/types";

interface LeadNotesDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Lead) => void;
}

export function LeadNotesDialog({
  lead,
  open,
  onOpenChange,
  onSaved,
}: LeadNotesDialogProps) {
  const [notes, setNotes] = useState(lead?.notes || "");
  const [saving, setSaving] = useState(false);

  // Sync notes when lead changes
  if (lead && notes !== (lead.notes || "") && !saving) {
    setNotes(lead.notes || "");
  }

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);

    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || null }),
    });

    if (!res.ok) {
      toast.error("Failed to save notes");
      setSaving(false);
      return;
    }

    const updated = await res.json();
    onSaved(updated);
    toast.success("Notes saved");
    setSaving(false);
    onOpenChange(false);
  };

  const name = lead
    ? [lead.attendee_first_name, lead.attendee_last_name]
        .filter(Boolean)
        .join(" ") || lead.attendee_email
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {lead && (
            <p className="text-sm text-muted-foreground">
              {lead.attendee_email}
            </p>
          )}
          <Textarea
            placeholder="Add notes about this lead..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            disabled={saving}
          />
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Notes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
