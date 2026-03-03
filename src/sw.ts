import { Serwist, StaleWhileRevalidate, CacheFirst, ExpirationPlugin, CacheableResponsePlugin } from "serwist";
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching } from "serwist";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[];
  }
}

declare const self: ServiceWorkerGlobalScope;

// ─── Push notification handler ─────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const { title, body, icon, data: notificationData } = data;

  const options = {
    body: body || "New message",
    icon: icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: notificationData?.tag || "stirtrek-notification",
    renotify: true,
    data: notificationData,
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title || "Stir Trek", options),
      "setAppBadge" in navigator
        ? (navigator as unknown as { setAppBadge: (n: number) => Promise<void> }).setAppBadge(1).catch(() => {})
        : Promise.resolve(),
    ])
  );
});

// ─── Notification click handler ────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = new URL(
    event.notification.data?.url || "/emergency",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
      })
  );
});

// ─── Badge management from main thread ─────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SET_BADGE") {
    if ("setAppBadge" in navigator) {
      const nav = navigator as unknown as {
        setAppBadge: (n: number) => Promise<void>;
        clearAppBadge: () => Promise<void>;
      };
      if (event.data.count > 0) {
        nav.setAppBadge(event.data.count);
      } else {
        nav.clearAppBadge();
      }
    }
  }

  if (event.data?.type === "CLEAR_BADGE") {
    if ("clearAppBadge" in navigator) {
      (navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge();
    }
  }
});

// ─── Caching strategies ────────────────────────────────────────
const customCaching: RuntimeCaching[] = [
  // Speaker photos from Sessionize
  {
    matcher: ({ url }) => url.hostname === "sessionize.com",
    handler: new StaleWhileRevalidate({
      cacheName: "sessionize-images",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    }),
  },
  // Sponsor logos from stirtrek.com
  {
    matcher: ({ url }) => url.hostname === "stirtrek.com",
    handler: new StaleWhileRevalidate({
      cacheName: "stirtrek-assets",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    }),
  },
  // Google Fonts files (woff2) — long cache
  {
    matcher: ({ url }) => url.hostname === "fonts.gstatic.com",
    handler: new CacheFirst({
      cacheName: "google-fonts-webfonts",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...customCaching, ...defaultCache],
});

serwist.addEventListeners();
