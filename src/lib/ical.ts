import type { SessionWithDetails } from "@/lib/types";

/**
 * Format a Date as an iCal UTC datetime string (e.g. "20260501T150000Z").
 */
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Escape special characters for iCal text fields.
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generate an iCalendar (.ics) string for one or more sessions.
 */
export function generateICS(
  sessions: SessionWithDetails[],
  eventName: string,
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stir Trek//App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(eventName)}`,
  ];

  for (const session of sessions) {
    if (!session.starts_at || !session.ends_at) continue;

    const start = new Date(session.starts_at);
    const end = new Date(session.ends_at);
    const uid = `${session.id}@stirtrek.com`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${formatICalDate(start)}`);
    lines.push(`DTEND:${formatICalDate(end)}`);
    lines.push(`SUMMARY:${escapeICalText(session.title)}`);
    if (session.description) {
      lines.push(`DESCRIPTION:${escapeICalText(session.description)}`);
    }
    if (session.room) {
      lines.push(`LOCATION:${escapeICalText(session.room.name)}`);
    }
    if (session.speakers.length > 0) {
      const names = session.speakers.map((s) => s.full_name).join(", ");
      lines.push(`ORGANIZER;CN=${escapeICalText(names)}:MAILTO:noreply@stirtrek.com`);
    }
    lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
