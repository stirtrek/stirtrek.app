import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a Sessionize timestamp for display.
 * Sessionize sends timestamps without timezone info (e.g. "2025-05-02T08:30:00")
 * representing Eastern Time. Postgres stores them as UTC (same numbers, wrong label).
 * We display with timeZone: "UTC" to recover the original Eastern time values.
 */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Find the current or most recent time slot that has started.
 * Times are sorted ascending ISO strings (Sessionize "fake UTC" = Eastern).
 * `now` should also be in the same "fake UTC" format from getNow().
 * Returns null if no slot has started yet (event hasn't begun).
 */
export function findCurrentSlot(times: string[], now: Date): string | null {
  if (times.length === 0) return null;
  let current: string | null = null;
  for (const t of times) {
    if (new Date(t) <= now) {
      current = t;
    } else {
      break;
    }
  }
  return current;
}
