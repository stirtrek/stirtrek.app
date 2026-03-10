import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──

const mockUser = { id: "user-123", email: "test@example.com" };
let mockGetUser: ReturnType<typeof vi.fn>;

// Track admin queries by table
const adminQueryResults = new Map<string, { data: unknown; error: unknown }>();

function makeAdminChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "single", "insert", "update"];
  for (const m of methods) {
    if (m === "single") {
      chain[m] = vi.fn().mockResolvedValue(result);
    } else if (m === "insert") {
      chain[m] = vi.fn().mockResolvedValue(result);
    } else {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
  }
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
  })),
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

const mockStripeCheckoutCreate = vi.fn().mockResolvedValue({
  id: "cs_test_123",
  url: "https://checkout.stripe.com/test",
});

const mockStripeCustomerCreate = vi.fn().mockResolvedValue({
  id: "cus_test_123",
});

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: mockStripeCheckoutCreate,
      },
    },
    customers: {
      create: mockStripeCustomerCreate,
    },
  }),
}));

import { POST } from "@/app/api/checkout/route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    new URL("http://localhost:3000/api/checkout"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const validBody = {
  tier_id: "essential",
  addon_ids: [],
  event_name: "Test Event",
  event_slug: "test-event",
};

describe("POST /api/checkout", () => {
  beforeEach(() => {
    mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser } });
    adminQueryResults.clear();

    // Default: no existing event, no pending order, profile without stripe ID
    adminQueryResults.set("events", { data: null, error: null });
    adminQueryResults.set("orders", { data: null, error: null });
    adminQueryResults.set("profiles", {
      data: { stripe_customer_id: null, email: "test@example.com" },
      error: null,
    });

    mockStripeCheckoutCreate.mockClear();
    mockStripeCustomerCreate.mockClear();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/checkout"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeRequest({ tier_id: "essential" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("returns 400 for invalid tier", async () => {
    const res = await POST(
      makeRequest({ ...validBody, tier_id: "nonexistent" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid tier");
  });

  it("returns 400 for invalid slug format", async () => {
    const res = await POST(
      makeRequest({ ...validBody, event_slug: "Has Spaces!" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Slug must contain");
  });

  it("returns 409 when slug already exists as an event", async () => {
    adminQueryResults.set("events", {
      data: { id: "existing-event" },
      error: null,
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already exists");
  });

  it("creates Stripe customer when user has none", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(mockStripeCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        metadata: { user_id: "user-123" },
      }),
    );
  });

  it("creates checkout session with correct line items", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [{ price: "price_test_essential", quantity: 1 }],
        metadata: expect.objectContaining({
          user_id: "user-123",
          event_name: "Test Event",
          event_slug: "test-event",
          tier_id: "essential",
        }),
      }),
    );
  });

  it("returns checkout URL on success", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkout_url).toBe("https://checkout.stripe.com/test");
  });

  it("includes add-on prices in line items", async () => {
    const bodyWithAddons = {
      ...validBody,
      addon_ids: ["polls", "feedback"],
    };
    await POST(makeRequest(bodyWithAddons));
    expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          { price: "price_test_essential", quantity: 1 },
          { price: "price_test_polls", quantity: 1 },
          { price: "price_test_feedback", quantity: 1 },
        ],
      }),
    );
  });

  it("filters out invalid add-on IDs", async () => {
    const bodyWithBadAddon = {
      ...validBody,
      addon_ids: ["polls", "nonexistent"],
    };
    await POST(makeRequest(bodyWithBadAddon));
    expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          { price: "price_test_essential", quantity: 1 },
          { price: "price_test_polls", quantity: 1 },
        ],
      }),
    );
  });
});
