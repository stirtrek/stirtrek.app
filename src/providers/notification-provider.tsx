"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { useEvent } from "./event-provider";
import { useMembership } from "./membership-provider";
import type { EmergencyMessageStatus } from "@/lib/types";

interface NotificationContextValue {
  unreadCount: number;
  loading: boolean;
  pushSupported: boolean;
  pushSubscribed: boolean;
  subscribeToPush: () => Promise<"subscribed" | "denied" | "dismissed" | "unsupported" | "error">;
  updateMessageStatus: (messageId: string, status: EmergencyMessageStatus) => Promise<void>;
  markRepliesRead: (replyIds: string[]) => Promise<void>;
  refreshCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  loading: true,
  pushSupported: false,
  pushSubscribed: false,
  subscribeToPush: async () => "unsupported" as const,
  updateMessageStatus: async () => {},
  markRepliesRead: async () => {},
  refreshCount: async () => {},
});

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Set badge via both main thread and service worker */
function setBadge(count: number) {
  // Main thread
  if ("setAppBadge" in navigator) {
    const nav = navigator as Navigator & {
      setAppBadge: (n: number) => Promise<void>;
      clearAppBadge: () => Promise<void>;
    };
    if (count > 0) {
      nav.setAppBadge(count).catch(() => { /* Badge API not supported on all platforms */ });
    } else {
      nav.clearAppBadge().catch(() => { /* Badge API not supported on all platforms */ });
    }
  }

  // Relay to service worker (for when main thread isn't active)
  navigator.serviceWorker?.controller?.postMessage(
    count > 0
      ? { type: "SET_BADGE", count }
      : { type: "CLEAR_BADGE" }
  );
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { eventSlug, eventId } = useEvent();
  const { isAdmin } = useMembership();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    setPushSupported(
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }, []);

  const refreshCount = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch(`/${eventSlug}/api/emergency/unread-count`);
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }, [user, eventSlug]);

  // Fetch initial count
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    refreshCount().then(() => setLoading(false));
  }, [user, refreshCount]);

  // Sync existing push subscription with server (no permission prompt)
  useEffect(() => {
    if (!pushSupported || !user) return;

    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        // Sync with server in case the DB record was lost
        const json = existing.toJSON();
        fetch(`/${eventSlug}/api/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        }).catch((err) => console.error("Failed to sync push subscription:", err));
        setPushSubscribed(true);
      }
      // If no existing subscription, don't auto-request.
      // iOS requires a user gesture to call Notification.requestPermission().
      // The subscribeToPush() function handles this via UI button tap.
    });
  }, [pushSupported, user, eventSlug]);

  // Subscribe to push notifications.
  // Returns a status string so the UI can give appropriate feedback.
  const subscribeToPush = useCallback(async (): Promise<
    "subscribed" | "denied" | "dismissed" | "unsupported" | "error"
  > => {
    if (!pushSupported) return "unsupported";

    // Check if permission was previously hard-denied (browser/OS level).
    // In this state requestPermission() returns "denied" instantly with
    // no dialog, so the user has no idea what went wrong.
    if (Notification.permission === "denied") return "denied";

    const permission = await Notification.requestPermission();
    if (permission === "denied") return "denied";
    if (permission !== "granted") return "dismissed";

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return "error";

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });

    const json = subscription.toJSON();
    await fetch(`/${eventSlug}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });

    setPushSubscribed(true);
    return "subscribed";
  }, [pushSupported, eventSlug]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    if (isAdmin) {
      const channel = supabase
        .channel("emergency-admin-notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "emergency_messages",
          },
          () => setUnreadCount((prev) => prev + 1)
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "emergency_messages",
          },
          (payload) => {
            if (payload.old.status !== payload.new.status) {
              refreshCount();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const channel = supabase
      .channel("emergency-user-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emergency_replies",
        },
        () => setUnreadCount((prev) => prev + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, supabase]);

  // Update PWA badge whenever count changes
  useEffect(() => {
    setBadge(unreadCount);
  }, [unreadCount]);

  const updateMessageStatus = useCallback(
    async (messageId: string, status: EmergencyMessageStatus) => {
      try {
        const res = await fetch(
          `/${eventSlug}/api/emergency/messages/${messageId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }
        );
        if (res.ok) {
          await refreshCount();
        }
      } catch (err) {
        console.error("Failed to update message status:", err);
      }
    },
    [refreshCount, eventSlug]
  );

  const markRepliesRead = useCallback(
    async (replyIds: string[]) => {
      if (replyIds.length === 0) return;

      try {
        const res = await fetch(`/${eventSlug}/api/emergency/replies/mark-read`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply_ids: replyIds }),
        });
        if (res.ok) {
          setUnreadCount((prev) => Math.max(0, prev - replyIds.length));
        }
      } catch (err) {
        console.error("Failed to mark replies as read:", err);
      }
    },
    [eventSlug]
  );

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        loading,
        pushSupported,
        pushSubscribed,
        subscribeToPush,
        updateMessageStatus,
        markRepliesRead,
        refreshCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
