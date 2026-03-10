import type { EventFeatureFlags } from "@/lib/types";

// ============================================================
// Tier definitions
// ============================================================

export interface Tier {
  id: "essential" | "all-in";
  name: string;
  description: string;
  priceCents: number;
  maxAttendees: number;
  maxAdmins: number;
  /** Features included in this tier beyond the base set */
  includedFeatures: (keyof EventFeatureFlags)[];
  badge?: string;
}

export const TIERS: Tier[] = [
  {
    id: "essential",
    name: "Essential",
    description:
      "Everything you need to run a great event. Schedule, speakers, push notifications, and announcements.",
    priceCents: 29900,
    maxAttendees: 500,
    maxAdmins: 1,
    includedFeatures: ["announcements", "venue_map", "emergency_reporting"],
  },
  {
    id: "all-in",
    name: "All-In",
    description:
      "The full Conference Day experience. Every feature, higher limits, and priority support.",
    priceCents: 49900,
    maxAttendees: 2000,
    maxAdmins: 5,
    includedFeatures: [
      "polls",
      "emergency_reporting",
      "sponsor_leads",
      "announcements",
      "feedback",
      "venue_map",
      "passport",
    ],
    badge: "Most Popular",
  },
];

// ============================================================
// Add-on definitions
// ============================================================

export interface AddOn {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  /** Which feature flag this add-on enables, if any */
  featureFlag?: keyof EventFeatureFlags;
  /** Special capability key (e.g. "domain", "max_admins") */
  capability?: string;
}

export const ADD_ONS: AddOn[] = [
  {
    id: "polls",
    name: "Live Polls",
    description: "Run real-time polls during sessions or throughout your event.",
    priceCents: 4900,
    featureFlag: "polls",
  },
  {
    id: "feedback",
    name: "Session Feedback",
    description: "Collect session ratings and comments from attendees.",
    priceCents: 4900,
    featureFlag: "feedback",
  },
  {
    id: "sponsor_leads",
    name: "Sponsor Lead Capture",
    description: "Let sponsors scan attendee badges and export contact lists.",
    priceCents: 9900,
    featureFlag: "sponsor_leads",
  },
  {
    id: "passport",
    name: "Sponsor Passport",
    description:
      "Gamified sponsor booth visits — attendees collect stamps for prizes.",
    priceCents: 7900,
    featureFlag: "passport",
  },
  {
    id: "domain",
    name: "Custom Domain",
    description: "Use your own domain (e.g. app.myconf.com) instead of conferenceday.app.",
    priceCents: 9900,
    capability: "domain",
  },
  {
    id: "extra_admins",
    name: "Additional Admins (up to 5)",
    description: "Add up to 4 more admin accounts beyond the included one.",
    priceCents: 4900,
    capability: "max_admins",
  },
];

// ============================================================
// Stripe Price ID mapping (loaded from env)
// ============================================================

export function getStripePriceId(itemId: string): string {
  const envKey = `STRIPE_PRICE_${itemId.toUpperCase().replace(/-/g, "_")}`;
  const priceId = process.env[envKey];
  if (!priceId) {
    throw new Error(`Missing env var ${envKey} for pricing item "${itemId}"`);
  }
  return priceId;
}

// ============================================================
// Compute feature flags from tier + add-ons
// ============================================================

export function computeFeatureFlags(
  tierId: string,
  addonIds: string[],
): EventFeatureFlags {
  const tier = TIERS.find((t) => t.id === tierId);

  const flags: EventFeatureFlags = {
    polls: false,
    emergency_reporting: false,
    sponsor_leads: false,
    announcements: false,
    feedback: false,
    venue_map: false,
    passport: false,
  };

  // Enable features from tier
  if (tier) {
    for (const f of tier.includedFeatures) {
      flags[f] = true;
    }
  }

  // Enable features from add-ons
  for (const addonId of addonIds) {
    const addon = ADD_ONS.find((a) => a.id === addonId);
    if (addon?.featureFlag) {
      flags[addon.featureFlag] = true;
    }
  }

  return flags;
}

// ============================================================
// Compute total price
// ============================================================

export function computeTotalCents(tierId: string, addonIds: string[]): number {
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) return 0;

  let total = tier.priceCents;
  for (const addonId of addonIds) {
    const addon = ADD_ONS.find((a) => a.id === addonId);
    if (addon) total += addon.priceCents;
  }
  return total;
}

// ============================================================
// Compute max attendees/admins from tier + add-ons
// ============================================================

export function computeLimits(
  tierId: string,
  addonIds: string[],
): { maxAttendees: number; maxAdmins: number } {
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) return { maxAttendees: 500, maxAdmins: 1 };

  let maxAdmins = tier.maxAdmins;
  if (addonIds.includes("extra_admins")) {
    maxAdmins = 5;
  }

  return { maxAttendees: tier.maxAttendees, maxAdmins };
}

// ============================================================
// Format price for display
// ============================================================

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

/**
 * Get the add-on IDs that are already included in a tier
 * (so the UI can disable/hide them).
 */
export function getIncludedAddonIds(tierId: string): string[] {
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) return [];

  return ADD_ONS.filter(
    (addon) =>
      addon.featureFlag && tier.includedFeatures.includes(addon.featureFlag),
  ).map((addon) => addon.id);
}
