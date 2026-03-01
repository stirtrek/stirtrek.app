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
 * Send a push notification to all subscriptions for a given user.
 * Silently removes expired/invalid subscriptions.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const telemetry = getTelemetryService();
  const admin = createAdminClient();

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: { url: payload.url || "/emergency" },
  });

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
        // 404 or 410 = subscription expired/invalid
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        }
      }
    }),
  );

  const successCount = subscriptions.length - expiredIds.length;
  telemetry.trackPushNotification("user", successCount, { userId });

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("id", expiredIds);
  }
}

/**
 * Send a push notification to all admin/staff users.
 * Uses 2 queries instead of N+1 for better performance.
 */
export async function sendPushToAdmins(payload: PushPayload) {
  const telemetry = getTelemetryService();
  const admin = createAdminClient();

  // Query 1: get admin/staff user IDs
  const { data: adminProfiles } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["admin", "staff"]);

  if (!adminProfiles || adminProfiles.length === 0) return;

  const adminIds = adminProfiles.map((p) => p.id);

  // Query 2: batch-fetch ALL subscriptions for those users
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .in("user_id", adminIds);

  if (!subscriptions || subscriptions.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: { url: payload.url || "/emergency" },
  });

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
  telemetry.trackPushNotification("admins", successCount);

  if (expiredIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("id", expiredIds);
  }
}
