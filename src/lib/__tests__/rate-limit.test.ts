import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const result = rateLimit("test-key-1", 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("tracks remaining count correctly", () => {
    for (let i = 0; i < 3; i++) {
      rateLimit("test-key-2", 5, 60_000);
    }
    const result = rateLimit("test-key-2", 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks when limit is reached", () => {
    for (let i = 0; i < 5; i++) {
      rateLimit("test-key-3", 5, 60_000);
    }
    const result = rateLimit("test-key-3", 5, 60_000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after the window expires", () => {
    for (let i = 0; i < 5; i++) {
      rateLimit("test-key-4", 5, 60_000);
    }
    // Move past the window
    vi.advanceTimersByTime(61_000);

    const result = rateLimit("test-key-4", 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("isolates different keys", () => {
    for (let i = 0; i < 5; i++) {
      rateLimit("key-a", 5, 60_000);
    }
    const result = rateLimit("key-b", 5, 60_000);
    expect(result.success).toBe(true);
  });

  it("uses sliding window (partial expiration)", () => {
    // Make 3 requests now
    for (let i = 0; i < 3; i++) {
      rateLimit("test-key-5", 5, 60_000);
    }

    // Advance 30 seconds, make 2 more
    vi.advanceTimersByTime(30_000);
    for (let i = 0; i < 2; i++) {
      rateLimit("test-key-5", 5, 60_000);
    }

    // At this point: 5 requests in window → should be blocked
    const blocked = rateLimit("test-key-5", 5, 60_000);
    expect(blocked.success).toBe(false);

    // Advance 31 more seconds → first 3 requests fall out of window
    vi.advanceTimersByTime(31_000);
    const allowed = rateLimit("test-key-5", 5, 60_000);
    expect(allowed.success).toBe(true);
    expect(allowed.remaining).toBe(2); // 2 from second batch + 1 new = 3, so 2 remaining
  });
});
