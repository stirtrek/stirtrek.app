"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MessageCard } from "@/components/emergency/message-card";
import { useNotifications } from "@/providers/notification-provider";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { EmergencyMessageWithReplies } from "@/lib/types";

type TabValue = "unread" | "all";

export default function AdminEmergencyPage() {
  const { markMessageRead, refreshCount } = useNotifications();
  const [messages, setMessages] = useState<EmergencyMessageWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>("unread");
  const supabase = useMemo(() => createClient(), []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/emergency/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

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
        `/api/emergency/messages/${messageId}/reply`,
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

  const handleMarkRead = async (messageId: string) => {
    await markMessageRead(messageId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, is_read: true } : m
      )
    );
  };

  const filtered =
    tab === "unread"
      ? messages.filter((m) => !m.is_read)
      : messages;

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h1 className="text-lg font-semibold">Emergency Messages</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setTab("unread")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "unread"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Unread{unreadCount > 0 && ` (${unreadCount})`}
        </button>
        <button
          onClick={() => setTab("all")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "all"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({messages.length})
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
              onMarkRead={handleMarkRead}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">
            {tab === "unread"
              ? "No unread messages"
              : "No emergency messages yet"}
          </p>
        </div>
      )}
    </div>
  );
}
