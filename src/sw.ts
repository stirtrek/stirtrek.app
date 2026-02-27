import { Serwist, StaleWhileRevalidate, CacheFirst, ExpirationPlugin, CacheableResponsePlugin } from "serwist";
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching } from "serwist";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[];
  }
}

declare const self: ServiceWorkerGlobalScope;

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
