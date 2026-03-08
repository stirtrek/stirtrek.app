/**
 * Lightweight offline mutation queue.
 *
 * Stores failed POST/PUT/PATCH/DELETE requests in localStorage and
 * retries them when connectivity returns. Designed for critical
 * user-facing mutations (bookmarks, feedback, emergency messages).
 */

const STORAGE_KEY = "stirtrek:offline-queue";

interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  createdAt: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getQueue(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMutation[]): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  } catch {
    // localStorage full or unavailable — silently drop
  }
}

/**
 * Enqueue a failed mutation for later retry.
 * Only call this when a fetch fails due to a network error (not a server error).
 */
export function enqueueMutation(
  url: string,
  init: RequestInit,
): void {
  const mutation: QueuedMutation = {
    id: generateId(),
    url,
    method: init.method || "POST",
    headers: (init.headers as Record<string, string>) || {},
    body: (init.body as string) || "",
    createdAt: Date.now(),
  };

  const queue = getQueue();
  // Cap queue size to prevent localStorage bloat
  if (queue.length >= 50) return;
  // Don't queue duplicates (same url + body)
  if (queue.some((q) => q.url === mutation.url && q.body === mutation.body)) return;

  queue.push(mutation);
  saveQueue(queue);
}

/**
 * Flush the offline queue by retrying all pending mutations.
 * Returns the number of successfully retried mutations.
 */
export async function flushQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  // Remove stale mutations (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const active = queue.filter((m) => m.createdAt > oneHourAgo);

  let successCount = 0;
  const failed: QueuedMutation[] = [];

  for (const mutation of active) {
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body || undefined,
      });
      if (res.ok || res.status === 409) {
        // 409 = duplicate, treat as success (already processed)
        successCount++;
      } else {
        failed.push(mutation);
      }
    } catch {
      // Still offline — keep in queue
      failed.push(mutation);
    }
  }

  saveQueue(failed);
  return successCount;
}

/**
 * Get the number of pending mutations in the queue.
 */
export function getQueueSize(): number {
  return getQueue().length;
}

let listenerAttached = false;

/**
 * Start listening for connectivity changes and auto-flush.
 * Safe to call multiple times — only attaches once.
 */
export function startOfflineQueueListener(
  onFlushed?: (count: number) => void,
): void {
  if (typeof window === "undefined" || listenerAttached) return;
  listenerAttached = true;

  const handleOnline = async () => {
    const count = await flushQueue();
    if (count > 0) {
      onFlushed?.(count);
    }
  };

  window.addEventListener("online", handleOnline);

  // Also try to flush on page load if we're online
  if (navigator.onLine && getQueueSize() > 0) {
    handleOnline();
  }
}
