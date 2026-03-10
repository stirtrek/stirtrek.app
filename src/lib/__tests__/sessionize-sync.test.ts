import { describe, it, expect, vi } from "vitest";

/**
 * Regression test: Sessionize returns UTC times. The sync must NOT
 * re-interpret them as local times. A previous bug called eventLocalToUTC()
 * on already-UTC values, shifting sessions by ~4 hours.
 */

// ── Mocks ──

let upsertedSessions: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { sessionize_api_id: "test-api-id" },
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
          startsAt: "2026-05-01T14:00:00Z",
          endsAt: "2026-05-01T15:00:00Z",
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
  it("stores Sessionize UTC times without conversion", async () => {
    upsertedSessions = [];
    await syncSessionizeData("test", "event-1");

    expect(upsertedSessions).toHaveLength(1);
    // Times must be stored exactly as Sessionize provides them (UTC)
    expect(upsertedSessions[0].starts_at).toBe("2026-05-01T14:00:00Z");
    expect(upsertedSessions[0].ends_at).toBe("2026-05-01T15:00:00Z");
  });

  it("preserves UTC times without timezone offset", async () => {
    // Verify the stored time matches UTC exactly — no +4h or -4h shift
    const stored = new Date(upsertedSessions[0].starts_at as string);
    const expected = new Date("2026-05-01T14:00:00Z");
    expect(stored.getTime()).toBe(expected.getTime());
  });
});
