"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEvent } from "@/providers/event-provider";
import { useSimulation } from "@/providers/simulation-provider";
import type { Lead } from "@/lib/types";

interface LeadNotesDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Lead) => void;
  onDeleted: (id: string) => void;
}

export function LeadNotesDialog({
  lead,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: LeadNotesDialogProps) {
  const { eventSlug } = useEvent();
  const { isSimulating } = useSimulation();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync notes only when a different lead is opened
  useEffect(() => {
    if (lead && open) {
      setNotes(lead.notes || "");
      setConfirmingDelete(false);
    }
  }, [lead?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!lead) return;
    if (isSimulating) {
      toast.error("Cannot save notes during simulation");
      return;
    }
    setSaving(true);

    const res = await fetch(`/${eventSlug}/api/leads/${lead.id}`, {
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

  const handleDelete = async () => {
    if (!lead) return;
    if (isSimulating) {
      toast.error("Cannot delete leads during simulation");
      return;
    }
    setDeleting(true);

    const res = await fetch(`/${eventSlug}/api/leads/${lead.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      toast.error("Failed to delete lead");
      setDeleting(false);
      return;
    }

    onDeleted(lead.id);
    toast.success("Lead deleted");
    setDeleting(false);
    setConfirmingDelete(false);
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
            disabled={saving || deleting}
          />
          <Button onClick={handleSave} disabled={saving || deleting} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Notes"
            )}
          </Button>

          {!confirmingDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
              disabled={saving || deleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Lead
            </Button>
          ) : (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-3">
              <p className="text-sm text-center">
                Are you sure you want to delete this lead?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
