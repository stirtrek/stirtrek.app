import { describe, it, expect } from "vitest";
import {
  parseSessionizeTime,
  formatTime,
  eventLocalToUTC,
  utcToEventLocal,
  isHappeningNow,
  isFeedbackAvailable,
  findCurrentSlot,
  getSessionDate,
  formatDayLabel,
} from "../utils";

describe("parseSessionizeTime", () => {
  it("parses bare ISO string as UTC", () => {
    const d = parseSessionizeTime("2026-05-01T15:00:00");
    expect(d.toISOString()).toBe("2026-05-01T15:00:00.000Z");
  });

  it("strips Z suffix", () => {
    const d = parseSessionizeTime("2026-05-01T15:00:00Z");
    expect(d.toISOString()).toBe("2026-05-01T15:00:00.000Z");
  });

  it("strips timezone offset", () => {
    const d = parseSessionizeTime("2026-05-01T15:00:00+00:00");
    expect(d.toISOString()).toBe("2026-05-01T15:00:00.000Z");
  });

  it("strips negative timezone offset", () => {
    // The function strips the offset and treats the bare time as UTC
    const d = parseSessionizeTime("2026-05-01T15:00:00-04:00");
    expect(d.toISOString()).toBe("2026-05-01T15:00:00.000Z");
  });
});

describe("formatTime", () => {
  it("formats UTC time in Eastern timezone", () => {
    // 15:00 UTC = 11:00 AM EDT (America/New_York in May = EDT, UTC-4)
    const result = formatTime("2026-05-01T15:00:00Z", "America/New_York");
    expect(result).toBe("11:00 AM");
  });

  it("formats UTC time in Pacific timezone", () => {
    // 15:00 UTC = 8:00 AM PDT (America/Los_Angeles in May = PDT, UTC-7)
    const result = formatTime("2026-05-01T15:00:00Z", "America/Los_Angeles");
    expect(result).toBe("8:00 AM");
  });

  it("returns empty string for invalid date", () => {
    expect(formatTime("not-a-date", "America/New_York")).toBe("");
  });
});

describe("eventLocalToUTC", () => {
  it("converts Eastern time to UTC", () => {
    // May 1, 2026 11:00 AM EDT → 15:00 UTC
    const result = eventLocalToUTC("2026-05-01T11:00", "America/New_York");
    expect(result).toBe("2026-05-01T15:00:00.000Z");
  });

  it("converts Pacific time to UTC", () => {
    // May 1, 2026 8:00 AM PDT → 15:00 UTC
    const result = eventLocalToUTC("2026-05-01T08:00", "America/Los_Angeles");
    expect(result).toBe("2026-05-01T15:00:00.000Z");
  });

  it("handles UTC timezone (no offset)", () => {
    const result = eventLocalToUTC("2026-05-01T15:00", "UTC");
    expect(result).toBe("2026-05-01T15:00:00.000Z");
  });
});

describe("utcToEventLocal", () => {
  it("converts UTC to Eastern datetime-local", () => {
    // 15:00 UTC → 11:00 EDT
    const result = utcToEventLocal("2026-05-01T15:00:00Z", "America/New_York");
    expect(result).toBe("2026-05-01T11:00");
  });

  it("converts UTC to Pacific datetime-local", () => {
    // 15:00 UTC → 08:00 PDT
    const result = utcToEventLocal("2026-05-01T15:00:00Z", "America/Los_Angeles");
    expect(result).toBe("2026-05-01T08:00");
  });

  it("returns empty string for invalid date", () => {
    expect(utcToEventLocal("garbage", "America/New_York")).toBe("");
  });

  it("round-trips with eventLocalToUTC", () => {
    const local = "2026-05-01T11:00";
    const tz = "America/New_York";
    const utc = eventLocalToUTC(local, tz);
    const backToLocal = utcToEventLocal(utc, tz);
    expect(backToLocal).toBe(local);
  });
});

describe("isHappeningNow", () => {
  it("returns true when now is between start and end", () => {
    const now = new Date("2026-05-01T15:30:00Z");
    expect(
      isHappeningNow("2026-05-01T15:00:00Z", "2026-05-01T16:00:00Z", now),
    ).toBe(true);
  });

  it("returns true when now equals start (inclusive)", () => {
    const now = new Date("2026-05-01T15:00:00Z");
    expect(
      isHappeningNow("2026-05-01T15:00:00Z", "2026-05-01T16:00:00Z", now),
    ).toBe(true);
  });

  it("returns false when now equals end (exclusive)", () => {
    const now = new Date("2026-05-01T16:00:00Z");
    expect(
      isHappeningNow("2026-05-01T15:00:00Z", "2026-05-01T16:00:00Z", now),
    ).toBe(false);
  });

  it("returns false when now is before start", () => {
    const now = new Date("2026-05-01T14:00:00Z");
    expect(
      isHappeningNow("2026-05-01T15:00:00Z", "2026-05-01T16:00:00Z", now),
    ).toBe(false);
  });

  it("returns false for null times", () => {
    const now = new Date();
    expect(isHappeningNow(null, "2026-05-01T16:00:00Z", now)).toBe(false);
    expect(isHappeningNow("2026-05-01T15:00:00Z", null, now)).toBe(false);
    expect(isHappeningNow(null, null, now)).toBe(false);
  });
});

describe("isFeedbackAvailable", () => {
  it("returns false if startsAt is null", () => {
    expect(isFeedbackAvailable(null, new Date())).toBe(false);
  });

  it("returns false if session hasn't started yet", () => {
    const now = new Date("2026-05-01T14:00:00Z");
    expect(isFeedbackAvailable("2026-05-01T15:00:00Z", now)).toBe(false);
  });

  it("returns true right after session starts", () => {
    const now = new Date("2026-05-01T15:01:00Z");
    expect(isFeedbackAvailable("2026-05-01T15:00:00Z", now)).toBe(true);
  });

  it("returns true within 14 days (336 hours)", () => {
    const start = new Date("2026-05-01T15:00:00Z");
    const now = new Date(start.getTime() + 335 * 60 * 60 * 1000); // 335 hours later
    expect(isFeedbackAvailable("2026-05-01T15:00:00Z", now)).toBe(true);
  });

  it("returns false after 14 days", () => {
    const start = new Date("2026-05-01T15:00:00Z");
    const now = new Date(start.getTime() + 337 * 60 * 60 * 1000); // 337 hours later
    expect(isFeedbackAvailable("2026-05-01T15:00:00Z", now)).toBe(false);
  });
});

describe("getSessionDate", () => {
  it("converts UTC timestamp to local date in Eastern timezone", () => {
    // 15:00 UTC on May 1 = 11:00 AM EDT on May 1
    expect(getSessionDate("2026-05-01T15:00:00Z", "America/New_York")).toBe("2026-05-01");
  });

  it("handles date rollback when UTC is early morning", () => {
    // 03:00 UTC on May 2 = 11:00 PM EDT on May 1
    expect(getSessionDate("2026-05-02T03:00:00Z", "America/New_York")).toBe("2026-05-01");
  });

  it("returns empty string for invalid date", () => {
    expect(getSessionDate("not-a-date", "America/New_York")).toBe("");
  });
});

describe("formatDayLabel", () => {
  it("formats date as weekday, month day", () => {
    const result = formatDayLabel("2026-05-01", "America/New_York");
    expect(result).toBe("Fri, May 1");
  });

  it("formats a different date", () => {
    const result = formatDayLabel("2026-05-02", "America/New_York");
    expect(result).toBe("Sat, May 2");
  });
});

describe("findCurrentSlot", () => {
  const times = [
    "2026-05-01T15:00:00Z",
    "2026-05-01T16:15:00Z",
    "2026-05-01T17:30:00Z",
  ];
  const eventDates = ["2026-05-01"];
  const tz = "America/New_York";

  it("returns null for empty times", () => {
    expect(findCurrentSlot([], new Date(), eventDates, tz)).toBeNull();
  });

  it("returns null on non-event day", () => {
    const now = new Date("2026-05-02T16:00:00Z"); // May 2
    expect(findCurrentSlot(times, now, eventDates, tz)).toBeNull();
  });

  it("returns null before first session on event day", () => {
    const now = new Date("2026-05-01T14:00:00Z"); // Before first session
    expect(findCurrentSlot(times, now, eventDates, tz)).toBeNull();
  });

  it("returns first slot when now is during first session", () => {
    const now = new Date("2026-05-01T15:30:00Z");
    expect(findCurrentSlot(times, now, eventDates, tz)).toBe(times[0]);
  });

  it("returns second slot when now is during second session", () => {
    const now = new Date("2026-05-01T16:30:00Z");
    expect(findCurrentSlot(times, now, eventDates, tz)).toBe(times[1]);
  });

  it("returns last slot when now is after all sessions", () => {
    const now = new Date("2026-05-01T20:00:00Z");
    expect(findCurrentSlot(times, now, eventDates, tz)).toBe(times[2]);
  });

  it("returns slot at exact start time (inclusive)", () => {
    const now = new Date("2026-05-01T16:15:00Z");
    expect(findCurrentSlot(times, now, eventDates, tz)).toBe(times[1]);
  });

  it("works with multi-day event dates", () => {
    const day2Times = [
      "2026-05-02T15:00:00Z",
      "2026-05-02T16:15:00Z",
    ];
    const multiDayDates = ["2026-05-01", "2026-05-02"];
    const now = new Date("2026-05-02T15:30:00Z");
    expect(findCurrentSlot(day2Times, now, multiDayDates, tz)).toBe(day2Times[0]);
  });

  it("returns null for empty eventDates array", () => {
    const now = new Date("2026-05-01T15:30:00Z");
    expect(findCurrentSlot(times, now, [], tz)).toBeNull();
  });
});
