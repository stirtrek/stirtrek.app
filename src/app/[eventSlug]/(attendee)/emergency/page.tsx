"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MessageCompose } from "@/components/emergency/message-compose";
import { MessageCard } from "@/components/emergency/message-card";
import { useNotifications } from "@/providers/notification-provider";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { enqueueMutation } from "@/lib/offline-queue";
import type { EmergencyMessageWithReplies } from "@/lib/types";

export default function EmergencyPage() {
  const { user, loading: authLoading } = useAuth();
  const { eventSlug } = useEvent();
  const { markRepliesRead, refreshCount } = useNotifications();
  const [messages, setMessages] = useState<EmergencyMessageWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/${eventSlug}/api/emergency/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);

        // Mark any unread replies as read
        const unreadReplyIds = data.messages
          .flatMap((m: EmergencyMessageWithReplies) => m.replies)
          .filter((r: { is_read: boolean }) => !r.is_read)
          .map((r: { id: string }) => r.id);

        if (unreadReplyIds.length > 0) {
          await markRepliesRead(unreadReplyIds);
        }
      }
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [eventSlug, markRepliesRead]);

  useEffect(() => {
    if (user) {
      fetchMessages();
    } else {
      setLoading(false);
    }
  }, [user, fetchMessages]);

  const handleSend = async (message: string) => {
    setSending(true);
    const url = `/${eventSlug}/api/emergency/messages`;
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    };

    try {
      const res = await fetch(url, init);

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to send message");
        return;
      }

      const newMessage = await res.json();
      setMessages((prev) => [{ ...newMessage, replies: [] }, ...prev]);
      toast.success("Message sent to event staff");
    } catch {
      // Network error — queue for retry when back online
      enqueueMutation(url, init);
      toast.error("You appear to be offline. Your message will be sent when connectivity returns.");
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (messageId: string, reply: string) => {
    const url = `/${eventSlug}/api/emergency/messages/${messageId}/reply`;
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };

    try {
      const res = await fetch(url, init);

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to send");
        return;
      }

      await fetchMessages();
    } catch {
      enqueueMutation(url, init);
      toast.error("You appear to be offline. Your reply will be sent when connectivity returns.");
    }
  };

  // Realtime: instantly refresh when a new reply arrives for the user's messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("emergency-replies-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emergency_replies",
        },
        () => {
          fetchMessages();
          refreshCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "emergency_messages",
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchMessages, refreshCount]);

  if (authLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Feedback & Concerns</h1>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Feedback & Concerns</h1>
        <p className="text-muted-foreground">
          Please sign in to send a message.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Feedback & Concerns</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Let the staff know there's a problem.
        </p>
      </div>

      {/* Compose form */}
      <MessageCompose onSend={handleSend} sending={sending} />

      {/* Message list */}
      {loading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : messages.length > 0 ? (
        <div className="space-y-1.5">
          <h2 className="text-sm font-medium text-muted-foreground">
            Your Messages
          </h2>
          {messages.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              isAdmin={false}
              onReply={handleReply}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
