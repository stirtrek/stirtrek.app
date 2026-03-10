import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──

const mockConstructEvent = vi.fn();
let adminQueryResults: Map<string, { data: unknown; error: unknown }>;
const mockAdminUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
});

function makeAdminChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
    update: mockAdminUpdate,
  };
}

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: (table: string) => {
      const result = adminQueryResults.get(table) ?? {
        data: null,
        error: null,
      };
      return makeAdminChain(result);
    },
  })),
}));

const mockProvisionEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/provisioning", () => ({
  provisionEvent: (...args: unknown[]) => mockProvisionEvent(...args),
}));

import { POST } from "@/app/api/webhooks/stripe/route";

function makeRequest(
  body: string,
  signature: string | null = "sig_test",
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signature) {
    headers["stripe-signature"] = signature;
  }
  return new NextRequest(
    new URL("http://localhost:3000/api/webhooks/stripe"),
    { method: "POST", headers, body },
  );
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    adminQueryResults = new Map();
    mockConstructEvent.mockReset();
    mockProvisionEvent.mockReset();
    mockAdminUpdate.mockClear();
  });

  it("returns 400 when signature is missing", async () => {
    const res = await POST(makeRequest("{}", null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing signature");
  });

  it("returns 400 when signature is invalid", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const res = await POST(makeRequest("{}", "bad_sig"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid signature");
  });

  it("handles checkout.session.completed - provisions event", async () => {
    const order = {
      id: "order-1",
      status: "pending",
      stripe_checkout_session_id: "cs_123",
    };
    adminQueryResults.set("orders", { data: order, error: null });

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          payment_intent: "pi_123",
        },
      },
    });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockProvisionEvent).toHaveBeenCalledWith(order);
  });

  it("skips provisioning for already completed orders", async () => {
    adminQueryResults.set("orders", {
      data: {
        id: "order-1",
        status: "completed",
        stripe_checkout_session_id: "cs_123",
      },
      error: null,
    });

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_123", payment_intent: "pi_123" },
      },
    });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockProvisionEvent).not.toHaveBeenCalled();
  });

  it("returns 404 when order not found", async () => {
    adminQueryResults.set("orders", {
      data: null,
      error: { message: "not found" },
    });

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_missing", payment_intent: "pi_123" },
      },
    });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when provisioning fails", async () => {
    adminQueryResults.set("orders", {
      data: {
        id: "order-1",
        status: "pending",
        stripe_checkout_session_id: "cs_123",
      },
      error: null,
    });

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_123", payment_intent: "pi_123" },
      },
    });

    mockProvisionEvent.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Provisioning failed");
  });

  it("handles checkout.session.expired", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: {
        object: { id: "cs_expired" },
      },
    });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockAdminUpdate).toHaveBeenCalledWith({ status: "expired" });
  });

  it("acknowledges unhandled event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.created",
      data: { object: {} },
    });

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});
