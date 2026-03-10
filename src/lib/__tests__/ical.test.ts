import { describe, it, expect } from "vitest";
import { generateICS } from "../ical";
import type { SessionWithDetails } from "@/lib/types";

function makeSession(overrides: Partial<SessionWithDetails> = {}): SessionWithDetails {
  return {
    id: "session-1",
    event_id: "event-1",
    title: "Test Session",
    description: null,
    starts_at: "2026-05-01T15:00:00Z",
    ends_at: "2026-05-01T16:00:00Z",
    room_id: null,
    is_service_session: false,
    is_plenum_session: false,
    live_url: null,
    recording_url: null,
    status: null,
    sessionize_data: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    room: null,
    speakers: [],
    categories: [],
    ...overrides,
  };
}

describe("generateICS", () => {
  it("generates valid iCalendar structure", () => {
    const ics = generateICS([makeSession()], "Test Event");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Stir Trek//App//EN");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("includes VEVENT for each session", () => {
    const sessions = [
      makeSession({ id: "s1", title: "Session One" }),
      makeSession({ id: "s2", title: "Session Two" }),
    ];
    const ics = generateICS(sessions, "Test Event");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("SUMMARY:Session One");
    expect(ics).toContain("SUMMARY:Session Two");
  });

  it("formats dates as iCal UTC format", () => {
    const ics = generateICS([makeSession()], "Test Event");
    expect(ics).toContain("DTSTART:20260501T150000Z");
    expect(ics).toContain("DTEND:20260501T160000Z");
  });

  it("includes UID based on session ID", () => {
    const ics = generateICS([makeSession({ id: "abc-123" })], "Test Event");
    expect(ics).toContain("UID:abc-123@stirtrek.com");
  });

  it("includes description when present", () => {
    const ics = generateICS(
      [makeSession({ description: "A great talk" })],
      "Test Event",
    );
    expect(ics).toContain("DESCRIPTION:A great talk");
  });

  it("includes room as LOCATION", () => {
    const ics = generateICS(
      [makeSession({ room: { id: 1, name: "Room A", event_id: "e1", sort_order: 0, created_at: "", updated_at: "" } })],
      "Test Event",
    );
    expect(ics).toContain("LOCATION:Room A");
  });

  it("includes speakers as ORGANIZER", () => {
    const ics = generateICS(
      [
        makeSession({
          speakers: [
            {
              id: "sp1",
              event_id: "e1",
              user_id: null,
              first_name: "Jane",
              last_name: "Doe",
              full_name: "Jane Doe",
              bio: null,
              tag_line: null,
              profile_picture: null,
              photo_override: null,
              is_top_speaker: false,
              links: [],
              sessionize_data: null,
              created_at: "",
              updated_at: "",
            },
          ],
        }),
      ],
      "Test Event",
    );
    expect(ics).toContain("ORGANIZER;CN=Jane Doe:MAILTO:noreply@stirtrek.com");
  });

  it("skips sessions without start/end times", () => {
    const ics = generateICS(
      [makeSession({ starts_at: null, ends_at: null })],
      "Test Event",
    );
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("escapes special characters in text fields", () => {
    const ics = generateICS(
      [makeSession({ title: "Hello; World, Test\\n" })],
      "Test Event",
    );
    expect(ics).toContain("SUMMARY:Hello\\; World\\, Test\\\\n");
  });

  it("uses CRLF line endings", () => {
    const ics = generateICS([makeSession()], "Test Event");
    expect(ics).toContain("\r\n");
    // Should not have bare \n (without preceding \r)
    const lines = ics.split("\r\n");
    for (const line of lines) {
      expect(line).not.toContain("\n");
    }
  });
});
