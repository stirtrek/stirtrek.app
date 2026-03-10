import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { EventProvider, useEvent, useEventOptional } from "../event-provider";
import type { Event } from "@/lib/types";
import type { ReactNode } from "react";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    slug: "test-event",
    name: "Test Event",
    short_name: null,
    description: null,
    logo_url: null,
    event_date: null,
    event_end_date: null,
    venue_name: null,
    venue_address: null,
    venue_maps_url: null,
    timezone: "America/New_York",
    sessionize_api_id: null,
    sponsor_feed_url: null,
    sponsor_access_code: null,
    feature_flags: {
      polls: false,
      emergency_reporting: false,
      sponsor_leads: false,
      announcements: false,
      feedback: false,
      venue_map: false,
      passport: false,
    },
    sponsor_tiers: [],
    schedule_message: null,
    about_content: null,
    accent_color: null,
    domain: null,
    is_active: true,
    show_on_marketing: false,
    order_id: null,
    stripe_customer_id: null,
    max_attendees: 500,
    max_admins: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function wrapper(event: Event) {
  return ({ children }: { children: ReactNode }) => (
    <EventProvider event={event}>{children}</EventProvider>
  );
}

describe("EventProvider", () => {
  it("provides event data via useEvent", () => {
    const event = makeEvent({ slug: "bacon", name: "Bacon Conf" });
    const { result } = renderHook(() => useEvent(), {
      wrapper: wrapper(event),
    });

    expect(result.current.eventSlug).toBe("bacon");
    expect(result.current.eventId).toBe("event-1");
    expect(result.current.event.name).toBe("Bacon Conf");
  });

  it("provides default accent color when none set", () => {
    const event = makeEvent({ accent_color: null });
    const { result } = renderHook(() => useEvent(), {
      wrapper: wrapper(event),
    });
    expect(result.current.accentColor).toBe("#FF3B3B");
  });

  it("uses event accent color when set", () => {
    const event = makeEvent({ accent_color: "#0000FF" });
    const { result } = renderHook(() => useEvent(), {
      wrapper: wrapper(event),
    });
    expect(result.current.accentColor).toBe("#0000FF");
  });

  it("hasFeature returns true for enabled features", () => {
    const event = makeEvent({
      feature_flags: {
        polls: true,
        emergency_reporting: false,
        sponsor_leads: false,
        announcements: true,
        feedback: false,
        venue_map: false,
        passport: false,
      },
    });
    const { result } = renderHook(() => useEvent(), {
      wrapper: wrapper(event),
    });

    expect(result.current.hasFeature("polls")).toBe(true);
    expect(result.current.hasFeature("announcements")).toBe(true);
    expect(result.current.hasFeature("feedback")).toBe(false);
    expect(result.current.hasFeature("emergency_reporting")).toBe(false);
  });

  it("applies default feature flags when event flags are partial", () => {
    // Default flags have polls: true, emergency_reporting: true, etc.
    // Event flags override them
    const event = makeEvent({
      feature_flags: {
        polls: false,
        emergency_reporting: false,
        sponsor_leads: false,
        announcements: false,
        feedback: false,
        venue_map: false,
        passport: false,
      },
    });
    const { result } = renderHook(() => useEvent(), {
      wrapper: wrapper(event),
    });
    // All explicitly set to false
    expect(result.current.hasFeature("polls")).toBe(false);
  });

  it("eventPath prefixes with slug", () => {
    const event = makeEvent({ slug: "bacon" });
    const { result } = renderHook(() => useEvent(), {
      wrapper: wrapper(event),
    });

    expect(result.current.eventPath("/schedule")).toBe("/bacon/schedule");
    expect(result.current.eventPath("/admin/polls")).toBe("/bacon/admin/polls");
    expect(result.current.eventPath("speakers")).toBe("/bacon/speakers");
  });

  it("throws when useEvent is used outside provider", () => {
    expect(() => {
      renderHook(() => useEvent());
    }).toThrow("useEvent must be used within an EventProvider");
  });

  it("useEventOptional returns null outside provider", () => {
    const { result } = renderHook(() => useEventOptional());
    expect(result.current).toBeNull();
  });
});
