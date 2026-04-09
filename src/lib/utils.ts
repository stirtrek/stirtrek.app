import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a UTC timestamp from the database.
 * Strips any trailing timezone indicator and forces UTC interpretation,
 * so values like "2026-05-01T15:00:00", "2026-05-01T15:00:00Z", and
 * "2026-05-01T15:00:00+00:00" all produce the same Date.
 *
 * @deprecated Prefer `new Date(iso)` for new code — all DB values are real UTC.
 * Kept for backwards compat with Sessionize sync and older data.
 */
export function parseSessionizeTime(iso: string): Date {
  const bare = iso.replace(/([Zz]|[+-]\d{2}(:\d{2})?)$/, "");
  return new Date(bare + "Z");
}

/**
 * Format a UTC timestamp for display in the event's timezone.
 *
 * @param iso - UTC ISO timestamp from the database
 * @param timezone - IANA timezone identifier (e.g. "America/New_York")
 */
export function formatTime(iso: string, timezone: string): string {
  const date = parseSessionizeTime(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/**
 * Convert a `datetime-local` input value (event-local time) to a real UTC ISO string.
 * The input represents time in the event's timezone; this converts it to UTC for storage.
 *
 * @param datetimeLocal - Value from a datetime-local input, e.g. "2026-05-01T11:00"
 * @param timezone - IANA timezone identifier (e.g. "America/New_York")
 * @returns ISO 8601 UTC string, e.g. "2026-05-01T15:00:00.000Z"
 */
export function eventLocalToUTC(datetimeLocal: string, timezone: string): string {
  // Build a Date that represents the given local time in the event's timezone.
  // We use the Intl API to find the UTC offset for that timezone at that moment.
  const naive = new Date(datetimeLocal + "Z"); // treat as UTC temporarily
  const utcStr = naive.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = naive.toLocaleString("en-US", { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  const offsetMs = utcDate.getTime() - tzDate.getTime();
  return new Date(naive.getTime() + offsetMs).toISOString();
}

/**
 * Convert a real UTC ISO string to a `datetime-local` input value in the event's timezone.
 *
 * @param iso - UTC ISO timestamp from the database
 * @param timezone - IANA timezone identifier (e.g. "America/New_York")
 * @returns String suitable for a datetime-local input, e.g. "2026-05-01T11:00"
 */
export function utcToEventLocal(iso: string, timezone: string): string {
  const date = parseSessionizeTime(iso);
  if (isNaN(date.getTime())) return "";
  // Format each component in the event timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Convert a UTC ISO timestamp to a local date string (YYYY-MM-DD) in the event's timezone.
 */
export function getSessionDate(iso: string, timezone: string): string {
  const date = parseSessionizeTime(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Format a YYYY-MM-DD date string into a human-readable label like "Fri, May 1".
 */
export function formatDayLabel(dateStr: string, timezone: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Check if `now` falls on any of the given event days in the event's timezone.
 */
function isEventDay(now: Date, eventDates: string[], timezone: string): boolean {
  const nowLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return eventDates.includes(nowLocal);
}

/**
 * Find the current or most recent time slot that has started.
 * Returns null on non-event days so the default selection is "All".
 *
 * All times are real UTC — direct comparison works.
 *
 * @param times - Sorted array of session start times (UTC ISO strings)
 * @param now - Current time (real UTC Date)
 * @param eventDates - Array of event date strings in "YYYY-MM-DD" format
 * @param timezone - IANA timezone identifier
 */
export function findCurrentSlot(
  times: string[],
  now: Date,
  eventDates: string[],
  timezone: string,
): string | null {
  if (times.length === 0) return null;
  if (eventDates.length === 0 || !isEventDay(now, eventDates, timezone)) return null;

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

/**
 * Returns true if feedback should be available for a session.
 * Requires: the session has started AND we are within 48 hours of the session start.
 *
 * @param startsAt - Session start time (UTC ISO string) or null
 * @param now - Current time (real UTC Date)
 */
/**
 * Returns true if a session is currently in progress.
 */
export function isHappeningNow(
  startsAt: string | null,
  endsAt: string | null,
  now: Date,
): boolean {
  if (!startsAt || !endsAt) return false;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return start <= now && now < end;
}

/**
 * Returns true if a session has ended (endsAt is in the past).
 */
export function hasSessionEnded(
  endsAt: string | null,
  now: Date,
): boolean {
  if (!endsAt) return false;
  return now >= new Date(endsAt);
}

/**
 * Returns the percentage (0–100) of a session that has elapsed.
 * Only meaningful when the session is currently in progress.
 */
export function sessionProgress(
  startsAt: string | null,
  endsAt: string | null,
  now: Date,
): number {
  if (!startsAt || !endsAt) return 0;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const total = end - start;
  if (total <= 0) return 0;
  const elapsed = now.getTime() - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

export function isFeedbackAvailable(
  startsAt: string | null,
  now: Date,
): boolean {
  if (!startsAt) return false;
  const start = new Date(startsAt);
  if (start > now) return false;
  const hoursSinceStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
  return hoursSinceStart <= 336; // 14 days (2 weeks)
}
