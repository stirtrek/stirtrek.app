import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ── Mocks ──

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
          eq: () => ({
            single: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/events/resolve", () => ({
  resolveEvent: vi.fn().mockResolvedValue({
    id: "event-123",
    slug: "bacon",
    name: "Bacon Conf",
  }),
  resolveEventByDomain: vi.fn().mockResolvedValue(null),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { resolveEvent, resolveEventByDomain } from "@/lib/events/resolve";

function makeRequest(url: string, host = "localhost:3000"): NextRequest {
  const req = new NextRequest(new URL(url, `http://${host}`), {
    headers: { host },
  });
  return req;
}

describe("middleware: global paths", () => {
  it("passes through /offline", async () => {
    const res = await updateSession(makeRequest("http://localhost:3000/offline"));
    // Global routes return NextResponse.next() (not a redirect/rewrite to marketing)
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).not.toBe(307);
  });

  it("passes through /create-event", async () => {
    const res = await updateSession(makeRequest("http://localhost:3000/create-event"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).not.toBe(307);
  });

  it("passes through /api/checkout", async () => {
    const res = await updateSession(makeRequest("http://localhost:3000/api/checkout"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("passes through /api/webhooks/stripe", async () => {
    const res = await updateSession(makeRequest("http://localhost:3000/api/webhooks/stripe"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("passes through /super-admin", async () => {
    const res = await updateSession(makeRequest("http://localhost:3000/super-admin"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("middleware: marketing host routing", () => {
  it("rewrites / on conferenceday.app to /marketing", async () => {
    const res = await updateSession(makeRequest("http://conferenceday.app/", "conferenceday.app"));
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toContain("/marketing");
  });

  it("rewrites /pricing on conferenceday.app to /marketing/pricing", async () => {
    const res = await updateSession(makeRequest("http://conferenceday.app/pricing", "conferenceday.app"));
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toContain("/marketing/pricing");
  });

  it("falls through to event slug for non-marketing paths on conferenceday.app", async () => {
    const res = await updateSession(makeRequest("http://conferenceday.app/bacon/schedule", "conferenceday.app"));
    // Should NOT rewrite to /marketing, should treat as platform domain
    const rewrite = res.headers.get("x-middleware-rewrite");
    if (rewrite) {
      expect(rewrite).not.toContain("/marketing");
    }
  });
});

describe("middleware: platform domain routing", () => {
  it("redirects legacy path /schedule to /stirtrek/schedule", async () => {
    const res = await updateSession(makeRequest("http://localhost:3000/schedule"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/stirtrek/schedule");
  });

  it("redirects legacy path /login to /stirtrek/login", async () => {
    const res = await updateSession(makeRequest("http://localhost:3000/login"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/stirtrek/login");
  });

  it("redirects legacy path /admin to /stirtrek/admin", async () => {
    const res = await updateSession(makeRequest("http://localhost:3000/admin"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/stirtrek/admin");
  });

  it("resolves event for slug-based paths", async () => {
    await updateSession(makeRequest("http://localhost:3000/bacon/schedule"));
    expect(resolveEvent).toHaveBeenCalledWith("bacon");
  });
});

describe("middleware: custom domain routing", () => {
  beforeEach(() => {
    vi.mocked(resolveEventByDomain).mockResolvedValue({
      id: "event-bacon",
      slug: "bacon",
      name: "Bacon Conf",
    } as ReturnType<typeof resolveEventByDomain> extends Promise<infer T> ? T : never);
  });

  it("rewrites custom domain paths with slug prefix", async () => {
    const res = await updateSession(
      makeRequest("http://bacon2026.com/schedule", "bacon2026.com"),
    );
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toContain("/bacon/schedule");
  });

  it("redirects slug-in-path on custom domain", async () => {
    const res = await updateSession(
      makeRequest("http://bacon2026.com/bacon/schedule", "bacon2026.com"),
    );
    // Should redirect to remove redundant slug
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/schedule");
    expect(location).not.toContain("/bacon/schedule");
  });
});
