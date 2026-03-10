import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks ──

const mockUser = { id: "user-123", email: "test@example.com" };
let mockGetUser: ReturnType<typeof vi.fn>;
let mockProfileUpdate: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          update: (data: unknown) => {
            mockProfileUpdate(data);
            return {
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { id: mockUser.id, ...data },
                      error: null,
                    }),
                }),
              }),
            };
          },
        };
      }
      return {};
    },
  })),
}));

vi.mock("@/lib/telemetry/service", () => ({
  getTelemetryService: () => ({
    trackAPIRoute: (
      _name: string,
      _method: string,
      handler: () => Promise<NextResponse>,
    ) => handler(),
    trackAuthEvent: vi.fn(),
  }),
}));

import { POST } from "@/app/api/profile/complete/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/profile/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/profile/complete", () => {
  beforeEach(() => {
    mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser } });
    mockProfileUpdate = vi.fn();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ first_name: "John", last_name: "Doe" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when first_name is missing", async () => {
    const res = await POST(makeRequest({ first_name: "", last_name: "Doe" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("returns 400 when last_name is missing", async () => {
    const res = await POST(makeRequest({ first_name: "John", last_name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost:3000/api/profile/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("updates profile successfully", async () => {
    const res = await POST(
      makeRequest({ first_name: "John", last_name: "Doe" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockProfileUpdate).toHaveBeenCalledWith({
      first_name: "John",
      last_name: "Doe",
    });
  });

  it("trims whitespace from names", async () => {
    await POST(makeRequest({ first_name: "  John  ", last_name: "  Doe  " }));
    expect(mockProfileUpdate).toHaveBeenCalledWith({
      first_name: "John",
      last_name: "Doe",
    });
  });
});
