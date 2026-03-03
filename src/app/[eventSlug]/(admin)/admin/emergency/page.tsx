"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MessageCard } from "@/components/emergency/message-card";
import { useNotifications } from "@/providers/notification-provider";
import { useEvent } from "@/providers/event-provider";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { EmergencyMessageStatus, EmergencyMessageWithReplies } from "@/lib/types";

type TabValue = "unresponded" | "acknowledged" | "closed";

export default function AdminEmergencyPage() {
  const { eventSlug, eventPath } = useEvent();
  const { updateMessageStatus, refreshCount } = useNotifications();
  const [messages, setMessages] = useState<EmergencyMessageWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>("unresponded");
  const supabase = useMemo(() => createClient(), []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/${eventSlug}/api/emergency/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime: instantly refresh when new messages arrive or replies are added
  useEffect(() => {
    const channel = supabase
      .channel("emergency-admin-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emergency_messages",
        },
        () => {
          fetchMessages();
          refreshCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emergency_replies",
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchMessages, refreshCount]);

  const handleReply = async (messageId: string, reply: string) => {
    try {
      const res = await fetch(
        `/${eventSlug}/api/emergency/messages/${messageId}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to send reply");
        return;
      }

      toast.success("Reply sent");
      await fetchMessages();
    } catch {
      toast.error("Failed to send reply");
    }
  };

  const handleStatusChange = async (messageId: string, status: EmergencyMessageStatus) => {
    await updateMessageStatus(messageId, status);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status } : m
      )
    );
  };

  const filtered = messages.filter((m) => m.status === tab);
  const unrespondedCount = messages.filter((m) => m.status === "unresponded").length;
  const acknowledgedCount = messages.filter((m) => m.status === "acknowledged").length;
  const closedCount = messages.filter((m) => m.status === "closed").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={eventPath("/admin")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <MessageCircle className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Feedback & Concerns</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setTab("unresponded")}
          className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
            tab === "unresponded"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          New{unrespondedCount > 0 && ` (${unrespondedCount})`}
        </button>
        <button
          onClick={() => setTab("acknowledged")}
          className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
            tab === "acknowledged"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Ack&apos;d{acknowledgedCount > 0 && ` (${acknowledgedCount})`}
        </button>
        <button
          onClick={() => setTab("closed")}
          className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
            tab === "closed"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Closed{closedCount > 0 && ` (${closedCount})`}
        </button>
      </div>

      {/* Messages */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              isAdmin={true}
              onReply={handleReply}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">
            {tab === "unresponded"
              ? "No new messages"
              : tab === "acknowledged"
              ? "No acknowledged messages"
              : "No closed messages"}
          </p>
        </div>
      )}
    </div>
  );
}
