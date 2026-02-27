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

interface NotificationContextValue {
  unreadCount: number;
  loading: boolean;
  pushSupported: boolean;
  pushSubscribed: boolean;
  subscribeToPush: () => Promise<void>;
  markMessageRead: (messageId: string) => Promise<void>;
  markRepliesRead: (replyIds: string[]) => Promise<void>;
  refreshCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  loading: true,
  pushSupported: false,
  pushSubscribed: false,
  subscribeToPush: async () => {},
  markMessageRead: async () => {},
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
      nav.setAppBadge(count).catch(() => {});
    } else {
      nav.clearAppBadge().catch(() => {});
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
  const { user, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const isAdmin = profile && ["admin", "staff"].includes(profile.role);

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
      const res = await fetch("/api/emergency/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // Silently fail
    }
  }, [user]);

  // Fetch initial count
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    refreshCount().then(() => setLoading(false));
  }, [user, refreshCount]);

  // Auto-subscribe to push when user is logged in and push is supported
  useEffect(() => {
    if (!pushSupported || !user) return;

    navigator.serviceWorker.ready.then(async (reg) => {
      // Check if already subscribed
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setPushSubscribed(true);
        return;
      }

      // Auto-request permission and subscribe
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;

      try {
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        });

        const json = subscription.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
          }),
        });

        setPushSubscribed(true);
      } catch {
        // Silently fail — user denied or browser doesn't support
      }
    });
  }, [pushSupported, user]);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!pushSupported) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });

    const json = subscription.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });

    setPushSubscribed(true);
  }, [pushSupported]);

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
            if (payload.new.is_read && !payload.old.is_read) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
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

  const markMessageRead = useCallback(
    async (messageId: string) => {
      try {
        const res = await fetch(
          `/api/emergency/messages/${messageId}/read`,
          { method: "PATCH" }
        );
        if (res.ok) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch {
        // Silently fail
      }
    },
    []
  );

  const markRepliesRead = useCallback(
    async (replyIds: string[]) => {
      if (replyIds.length === 0) return;

      try {
        const res = await fetch("/api/emergency/replies/mark-read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply_ids: replyIds }),
        });
        if (res.ok) {
          setUnreadCount((prev) => Math.max(0, prev - replyIds.length));
        }
      } catch {
        // Silently fail
      }
    },
    []
  );

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        loading,
        pushSupported,
        pushSubscribed,
        subscribeToPush,
        markMessageRead,
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
