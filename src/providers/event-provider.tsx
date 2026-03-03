"use client";

import { createContext, useContext } from "react";
import type { Event, EventFeatureFlags } from "@/lib/types";

interface EventContextValue {
  event: Event;
  eventSlug: string;
  eventId: string;
  /** The event's accent color (for buttons, highlights, etc.) */
  accentColor: string;
  /** Check if a feature is enabled for this event */
  hasFeature: (feature: keyof EventFeatureFlags) => boolean;
  /** Prefix a path with the event slug, e.g. "/schedule" → "/stirtrek/schedule" */
  eventPath: (path: string) => string;
}

const EventContext = createContext<EventContextValue | null>(null);

const DEFAULT_FEATURE_FLAGS: EventFeatureFlags = {
  polls: true,
  emergency_reporting: true,
  sponsor_leads: true,
  announcements: true,
  feedback: true,
  venue_map: false,
  passport: true,
};

export function EventProvider({
  event,
  children,
}: {
  event: Event;
  children: React.ReactNode;
}) {
  const accentColor = event.accent_color || "#FF3B3B";
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...event.feature_flags };

  const hasFeature = (feature: keyof EventFeatureFlags): boolean => {
    return flags[feature] ?? false;
  };

  const eventPath = (path: string): string => {
    // Ensure path starts with /
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `/${event.slug}${normalized}`;
  };

  return (
    <EventContext.Provider
      value={{
        event,
        eventSlug: event.slug,
        eventId: event.id,
        accentColor,
        hasFeature,
        eventPath,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvent(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
}

/**
 * Optional hook — returns null when outside EventProvider.
 * Useful for shared components that may render at root level.
 */
export function useEventOptional(): EventContextValue | null {
  return useContext(EventContext);
}
