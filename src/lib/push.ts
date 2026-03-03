import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:admin@stirtrek.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send push notifications and clean up expired subscriptions.
 * Shared helper used by all send functions.
 */
async function sendAndCleanup(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscriptions: any[],
  message: string,
  label: "user" | "admins" | "all",
  meta?: Record<string, string>,
) {
  const telemetry = getTelemetryService();
  const admin = createAdminClient();
  const expiredIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          message,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        }
      }
    }),
  );

  const successCount = subscriptions.length - expiredIds.length;
  telemetry.trackPushNotification(label, successCount, meta);

  if (expiredIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("id", expiredIds);
  }
}

/**
 * Send a push notification to all subscriptions for a given user.
 * When eventId is provided, only sends to subscriptions for that event.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  eventId?: string,
) {
  const admin = createAdminClient();

  let query = admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", userId);

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  const { data: subscriptions } = await query;
  if (!subscriptions || subscriptions.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: { url: payload.url || "/emergency" },
  });

  await sendAndCleanup(subscriptions, message, "user", { userId });
}

/**
 * Send a push notification to all admin/staff users for a specific event.
 * Uses event_memberships to determine who the admins are.
 */
export async function sendPushToAdmins(
  payload: PushPayload,
  eventId: string,
) {
  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("event_memberships")
    .select("user_id")
    .eq("event_id", eventId)
    .in("role", ["admin", "staff"]);

  if (!memberships || memberships.length === 0) return;
  const adminIds = memberships.map((m) => m.user_id);

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .in("user_id", adminIds)
    .eq("event_id", eventId);
  if (!subscriptions || subscriptions.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: { url: payload.url || "/emergency" },
  });

  await sendAndCleanup(subscriptions, message, "admins");
}

/**
 * Send a push notification to ALL users with push subscriptions for an event.
 * Used for broadcast announcements.
 * When eventId is provided, only sends to subscriptions for that event.
 */
export async function sendPushToAll(
  payload: PushPayload,
  eventId?: string,
) {
  const admin = createAdminClient();

  let query = admin
    .from("push_subscriptions")
    .select("id, endpoint, keys");

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  const { data: subscriptions } = await query;
  if (!subscriptions || subscriptions.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: { url: payload.url || "/announcements", tag: "announcement" },
  });

  await sendAndCleanup(subscriptions, message, "all");
}
