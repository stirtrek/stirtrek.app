import { describe, it, expect, vi } from "vitest";

/**
 * Regression test: Sessionize returns naive local wall-clock times in the
 * event's timezone (no offset, e.g. "2026-05-01T14:00:00"). The rest of the
 * app stores and reasons about timestamps as real UTC, so the sync must
 * convert Sessionize's event-local times to UTC using the event timezone.
 * A previous bug stored the naive value verbatim, so an 8am-Eastern session
 * landed as 8am UTC and rendered ~4 hours early.
 */

// ── Mocks ──

let upsertedSessions: Record<string, unknown>[] = [];
let eventTimezone: string | null = "America/New_York";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    sessionize_api_id: "test-api-id",
                    timezone: eventTimezone,
                  },
                }),
            }),
          }),
        };
      }
      if (table === "sessionize_sync_log") {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "sync-1" } }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === "sessions") {
        return {
          upsert: (rows: Record<string, unknown>[]) => {
            upsertedSessions = rows;
            return Promise.resolve({ error: null });
          },
        };
      }
      // Default passthrough for rooms, speakers, categories, etc.
      return {
        upsert: () => Promise.resolve({ error: null }),
        select: () => ({
          eq: () => ({
            not: () => Promise.resolve({ data: [] }),
          }),
        }),
      };
    },
  }),
}));

vi.mock("@/lib/sessionize/client", () => ({
  fetchSessionizeData: () =>
    Promise.resolve({
      rooms: [],
      categories: [],
      speakers: [],
      sessions: [
        {
          id: "sess-1",
          title: "Test Session",
          description: "A talk",
          // Naive local time as Sessionize returns it (2pm Eastern, EDT = UTC-4)
          startsAt: "2026-05-01T14:00:00",
          endsAt: "2026-05-01T15:00:00",
          roomId: null,
          speakers: [],
          categoryItems: [],
          isServiceSession: false,
          isPlenumSession: false,
          liveUrl: null,
          recordingUrl: null,
          status: null,
        },
      ],
    }),
}));

vi.mock("@/lib/telemetry/service", () => ({
  getTelemetryService: () => ({
    trackSessionizeSync: (fn: () => Promise<unknown>) => fn(),
    logInfo: vi.fn(),
    logError: vi.fn(),
  }),
}));

import { syncSessionizeData } from "@/lib/sessionize/sync";

describe("Sessionize sync - time handling", () => {
  it("converts Sessionize event-local times to UTC", async () => {
    eventTimezone = "America/New_York";
    upsertedSessions = [];
    await syncSessionizeData("test", "event-1");

    expect(upsertedSessions).toHaveLength(1);
    // 2pm Eastern on May 1 (EDT, UTC-4) → 6pm UTC
    const start = new Date(upsertedSessions[0].starts_at as string);
    const end = new Date(upsertedSessions[0].ends_at as string);
    expect(start.getTime()).toBe(new Date("2026-05-01T18:00:00Z").getTime());
    expect(end.getTime()).toBe(new Date("2026-05-01T19:00:00Z").getTime());
  });

  it("stores the raw value when the event has no timezone configured", async () => {
    eventTimezone = null;
    upsertedSessions = [];
    await syncSessionizeData("test", "event-1");

    expect(upsertedSessions[0].starts_at).toBe("2026-05-01T14:00:00");
    expect(upsertedSessions[0].ends_at).toBe("2026-05-01T15:00:00");
  });
});
