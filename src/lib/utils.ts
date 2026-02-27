import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { EVENT_DATE } from "@/lib/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a Sessionize "fake UTC" timestamp as UTC.
 * Sessionize timestamps represent Eastern Time but are stored as "fake UTC"
 * numbers (e.g. "2026-05-01T10:00:00" means 10 AM Eastern). Supabase may
 * return them with a "+00:00" offset. We strip any timezone indicator and
 * force UTC so comparisons are always apples-to-apples.
 */
export function parseSessionizeTime(iso: string): Date {
  // Strip trailing timezone (Z, +HH:MM, -HH:MM, +HH, -HH) then force UTC
  const bare = iso.replace(/([Zz]|[+-]\d{2}(:\d{2})?)$/, "");
  return new Date(bare + "Z");
}

/**
 * Format a Sessionize timestamp for display.
 * Displays with timeZone: "UTC" to recover the original Eastern time values.
 */
export function formatTime(iso: string): string {
  const date = parseSessionizeTime(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Normalize a session timestamp onto EVENT_DATE, keeping only time-of-day.
 * This lets us compare session times regardless of what year the data is from.
 */
function toEventDay(sessionTime: Date): Date {
  const [year, month, day] = EVENT_DATE.split("-").map(Number);
  const result = new Date(sessionTime);
  result.setUTCFullYear(year, month - 1, day);
  return result;
}

/**
 * Check if `now` falls on event day (month+day match, year ignored).
 */
function isEventDay(now: Date): boolean {
  return now.toISOString().slice(5, 10) === EVENT_DATE.slice(5, 10);
}

/**
 * Find the current or most recent time slot that has started.
 * Returns null on non-event days so the default selection is "All".
 */
export function findCurrentSlot(times: string[], now: Date): string | null {
  if (times.length === 0) return null;
  if (!isEventDay(now)) return null;

  let current: string | null = null;
  for (const t of times) {
    if (toEventDay(parseSessionizeTime(t)) <= now) {
      current = t;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Returns true if feedback should be available for a session.
 * Requires: it's event day AND the session's time-of-day has passed.
 */
export function isFeedbackAvailable(
  startsAt: string | null,
  now: Date
): boolean {
  if (!startsAt) return false;
  if (!isEventDay(now)) return false;
  return toEventDay(parseSessionizeTime(startsAt)) <= now;
}
