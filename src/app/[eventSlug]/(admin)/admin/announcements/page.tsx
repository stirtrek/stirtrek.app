"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Send,
  Save,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { useEvent } from "@/providers/event-provider";
import type { Announcement } from "@/lib/types";

export default function AdminAnnouncementsPage() {
  const { eventSlug, eventPath } = useEvent();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  const sent = announcements.filter((a) => a.status === "sent");

  const handleSendNow = async () => {
    if (!message.trim()) return;
    if (!window.confirm("Send this announcement to all users now?")) return;

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

  const handleSendDraft = async (id: string) => {
    if (!window.confirm("Send this announcement to all users now?")) return;

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

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this draft?")) return;

    setDeletingId(id);
    const res = await fetch(`/${eventSlug}/api/admin/announcements/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("Draft deleted");
      fetchAnnouncements();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to delete draft");
    }
    setDeletingId(null);
  };

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
              onClick={handleSendNow}
              disabled={busy || !message.trim()}
              className="flex-1"
            >
              {sending ? (
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
              Save for Later
            </Button>
          </div>
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
                        onClick={() => handleSendDraft(draft.id)}
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
                        onClick={() => handleDelete(draft.id)}
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty state */}
          {drafts.length === 0 && sent.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Megaphone className="h-8 w-8" />
              <p className="text-sm">
                No announcements yet. Write one above to get started.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
