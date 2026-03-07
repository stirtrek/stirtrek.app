"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Send,
  Save,
  Megaphone,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useEvent } from "@/providers/event-provider";
import { eventLocalToUTC } from "@/lib/utils";
import type { Announcement } from "@/lib/types";

type ConfirmAction =
  | { type: "send-now" }
  | { type: "send-draft"; id: string }
  | { type: "delete"; id: string }
  | { type: "schedule" }
  | { type: "cancel-schedule"; id: string };

export default function AdminAnnouncementsPage() {
  const { eventSlug, eventPath, event } = useEvent();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    const res = await fetch(`/${eventSlug}/api/admin/announcements`);
    if (res.ok) {
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    }
    setLoading(false);
  }, [eventSlug]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const drafts = announcements.filter((a) => a.status === "draft");
  const scheduled = announcements.filter((a) => a.status === "scheduled");
  const sent = announcements.filter((a) => a.status === "sent");

  const doSendNow = async () => {
    setSending(true);
    const res = await fetch(`/${eventSlug}/api/admin/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim(), send_now: true }),
    });

    if (res.ok) {
      toast.success("Announcement sent to all users");
      setMessage("");
      fetchAnnouncements();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to send announcement");
    }
    setSending(false);
  };

  const handleSaveForLater = async () => {
    if (!message.trim()) return;

    setSavingDraft(true);
    const res = await fetch(`/${eventSlug}/api/admin/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim(), send_now: false }),
    });

    if (res.ok) {
      toast.success("Draft saved");
      setMessage("");
      fetchAnnouncements();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to save draft");
    }
    setSavingDraft(false);
  };

  const doSchedule = async () => {
    if (!message.trim() || !scheduledFor) return;

    setSending(true);
    const utcTime = eventLocalToUTC(scheduledFor, event.timezone);
    const res = await fetch(`/${eventSlug}/api/admin/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message.trim(),
        send_now: false,
        scheduled_for: utcTime,
      }),
    });

    if (res.ok) {
      toast.success("Announcement scheduled");
      setMessage("");
      setScheduledFor("");
      setShowSchedulePicker(false);
      fetchAnnouncements();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to schedule announcement");
    }
    setSending(false);
  };

  const doSendDraft = async (id: string) => {
    setSendingId(id);
    const res = await fetch(`/${eventSlug}/api/admin/announcements/${id}/send`, {
      method: "POST",
    });

    if (res.ok) {
      toast.success("Announcement sent to all users");
      fetchAnnouncements();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to send announcement");
    }
    setSendingId(null);
  };

  const doCancelSchedule = async (id: string) => {
    const res = await fetch(`/${eventSlug}/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });

    if (res.ok) {
      toast.success("Schedule cancelled — moved back to drafts");
      fetchAnnouncements();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to cancel schedule");
    }
  };

  const doDelete = async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/${eventSlug}/api/admin/announcements/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("Announcement deleted");
      fetchAnnouncements();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to delete announcement");
    }
    setDeletingId(null);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setConfirmAction(null);

    switch (confirmAction.type) {
      case "send-now":
        return doSendNow();
      case "send-draft":
        return doSendDraft(confirmAction.id);
      case "delete":
        return doDelete(confirmAction.id);
      case "schedule":
        return doSchedule();
      case "cancel-schedule":
        return doCancelSchedule(confirmAction.id);
    }
  };

  const confirmTitle =
    confirmAction?.type === "delete"
      ? "Delete announcement?"
      : confirmAction?.type === "cancel-schedule"
        ? "Cancel scheduled announcement?"
        : confirmAction?.type === "schedule"
          ? "Schedule announcement?"
          : "Send announcement?";

  const confirmDescription =
    confirmAction?.type === "delete"
      ? "This announcement will be permanently removed."
      : confirmAction?.type === "cancel-schedule"
        ? "This will cancel the schedule and move the announcement back to drafts."
        : confirmAction?.type === "schedule"
          ? "This will schedule the announcement for delivery at the selected time."
          : "This will send a push notification to all users.";

  const confirmButtonLabel =
    confirmAction?.type === "delete"
      ? "Delete"
      : confirmAction?.type === "cancel-schedule"
        ? "Cancel Schedule"
        : confirmAction?.type === "schedule"
          ? "Schedule"
          : "Send";

  const busy = sending || savingDraft;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href={eventPath("/admin")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Announcements</h1>
      </div>

      {/* Compose */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Announcement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your announcement..."
            rows={3}
            disabled={busy}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (message.trim()) setConfirmAction({ type: "send-now" });
              }}
              disabled={busy || !message.trim()}
              className="flex-1"
            >
              {sending && !showSchedulePicker ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Send Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveForLater}
              disabled={busy || !message.trim()}
              className="flex-1"
            >
              {savingDraft ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Save Draft
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSchedulePicker(!showSchedulePicker)}
              disabled={busy || !message.trim()}
              className="flex-1"
            >
              <Clock className="mr-1 h-4 w-4" />
              Schedule
            </Button>
          </div>

          {showSchedulePicker && (
            <div className="space-y-2 rounded-md border p-3">
              <label className="text-xs text-muted-foreground">
                Schedule for ({event.timezone.replace(/^.*\//, "").replace(/_/g, " ")})
              </label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (message.trim() && scheduledFor) {
                    setConfirmAction({ type: "schedule" });
                  }
                }}
                disabled={!scheduledFor || !message.trim() || busy}
                className="w-full"
              >
                <Clock className="mr-1 h-4 w-4" />
                Confirm Schedule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Saved Drafts */}
          {drafts.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Saved Drafts
              </h2>
              {drafts.map((draft) => (
                <Card key={draft.id} className="gap-0 py-0">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary">Draft</Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {draft.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved{" "}
                      {new Date(draft.created_at).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                    <div className="mt-2 flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmAction({ type: "send-draft", id: draft.id })
                        }
                        disabled={sendingId === draft.id}
                      >
                        {sendingId === draft.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1 h-3.5 w-3.5" />
                        )}
                        Send
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          setConfirmAction({ type: "delete", id: draft.id })
                        }
                        disabled={deletingId === draft.id}
                      >
                        {deletingId === draft.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Scheduled */}
          {scheduled.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Scheduled
              </h2>
              {scheduled.map((item) => (
                <Card key={item.id} className="gap-0 py-0">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Badge className="bg-blue-600 text-white">
                        Scheduled
                      </Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {item.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <Clock className="mr-1 inline h-3 w-3" />
                      Scheduled for{" "}
                      {item.scheduled_for
                        ? new Date(item.scheduled_for).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone: event.timezone,
                            },
                          )
                        : "Unknown"}
                    </p>
                    <div className="mt-2 flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmAction({
                            type: "send-draft",
                            id: item.id,
                          })
                        }
                        disabled={sendingId === item.id}
                      >
                        {sendingId === item.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1 h-3.5 w-3.5" />
                        )}
                        Send Now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmAction({
                            type: "cancel-schedule",
                            id: item.id,
                          })
                        }
                      >
                        <Clock className="mr-1 h-3.5 w-3.5" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          setConfirmAction({ type: "delete", id: item.id })
                        }
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Sent History */}
          {sent.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Sent
              </h2>
              {sent.map((item) => (
                <Card key={item.id} className="gap-0 py-0">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline">Sent</Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {item.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sent{" "}
                      {item.sent_at
                        ? new Date(item.sent_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "Unknown"}
                    </p>
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          setConfirmAction({ type: "delete", id: item.id })
                        }
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty state */}
          {drafts.length === 0 && scheduled.length === 0 && sent.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Megaphone className="h-8 w-8" />
              <p className="text-sm">
                No announcements yet. Write one above to get started.
              </p>
            </div>
          )}
        </>
      )}

      {/* Confirmation modal */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                confirmAction?.type === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {confirmButtonLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
