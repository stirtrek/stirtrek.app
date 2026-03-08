/**
 * In-memory sliding window rate limiter.
 *
 * Each key maps to an array of request timestamps. On every call we discard
 * timestamps older than the window, then decide whether the caller is still
 * within the allowed limit.
 *
 * A periodic cleanup timer (every 60 s) removes keys whose timestamps have
 * all expired so the map does not grow without bound.
 *
 * NOTE: Because this lives in process memory it resets on every cold-start and
 * is per-isolate on Vercel serverless / edge. For a single-region deployment
 * this is usually fine; for stricter guarantees use an external store such as
 * Upstash Redis.
 */

const store = new Map<string, number[]>();

// ---------------------------------------------------------------------------
// Periodic cleanup – runs every 60 seconds to evict fully-expired keys
// ---------------------------------------------------------------------------
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of store) {
      // Remove entries whose newest timestamp is older than any reasonable
      // window. We use a generous 5-minute ceiling so we never accidentally
      // drop a key that is still within a caller's window.
      const newest = timestamps[timestamps.length - 1] ?? 0;
      if (now - newest > 5 * 60_000) {
        store.delete(key);
      }
    }
  }, 60_000);

  // Allow the Node process to exit naturally even if the timer is still
  // running (important for serverless environments).
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// Core rate-limit function
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

/**
 * Check (and record) a request against the sliding-window rate limit.
 *
 * @param key       Unique key, typically `IP:endpoint-name`
 * @param limit     Maximum number of requests allowed within `windowMs`
 * @param windowMs  Length of the sliding window in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  ensureCleanupTimer();

  const now = Date.now();
  const windowStart = now - windowMs;

  // Get existing timestamps and discard any that have fallen outside the window
  const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    // Over limit – store the pruned list but do NOT add a new timestamp
    store.set(key, timestamps);
    return { success: false, remaining: 0 };
  }

  // Under limit – record this request
  timestamps.push(now);
  store.set(key, timestamps);

  return { success: true, remaining: limit - timestamps.length };
}

// ---------------------------------------------------------------------------
// Helper – extract a usable IP from a Next.js Request
// ---------------------------------------------------------------------------

/**
 * Derive a rate-limit key prefix from the incoming request's IP address.
 *
 * Checks the `x-forwarded-for` header first (set by Vercel / reverse proxies),
 * then falls back to `"unknown"`.
 */
export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; take the first IP
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}
