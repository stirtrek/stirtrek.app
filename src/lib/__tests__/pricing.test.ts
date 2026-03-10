import { describe, it, expect } from "vitest";
import {
  TIERS,
  ADD_ONS,
  computeFeatureFlags,
  computeTotalCents,
  computeLimits,
  formatPrice,
  getIncludedAddonIds,
  getStripePriceId,
} from "../pricing";

describe("TIERS and ADD_ONS data integrity", () => {
  it("has exactly two tiers", () => {
    expect(TIERS).toHaveLength(2);
    expect(TIERS.map((t) => t.id)).toEqual(["essential", "all-in"]);
  });

  it("has unique add-on IDs", () => {
    const ids = ADD_ONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all tier prices are positive integers", () => {
    for (const tier of TIERS) {
      expect(tier.priceCents).toBeGreaterThan(0);
      expect(Number.isInteger(tier.priceCents)).toBe(true);
    }
  });
});

describe("computeFeatureFlags", () => {
  it("returns all-false for unknown tier with no add-ons", () => {
    const flags = computeFeatureFlags("nonexistent", []);
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
  });

  it("enables essential tier features", () => {
    const flags = computeFeatureFlags("essential", []);
    expect(flags.announcements).toBe(true);
    expect(flags.venue_map).toBe(true);
    expect(flags.emergency_reporting).toBe(true);
    // Not included in essential
    expect(flags.polls).toBe(false);
    expect(flags.feedback).toBe(false);
    expect(flags.sponsor_leads).toBe(false);
    expect(flags.passport).toBe(false);
  });

  it("enables all-in tier features", () => {
    const flags = computeFeatureFlags("all-in", []);
    expect(flags.polls).toBe(true);
    expect(flags.emergency_reporting).toBe(true);
    expect(flags.sponsor_leads).toBe(true);
    expect(flags.announcements).toBe(true);
    expect(flags.feedback).toBe(true);
    expect(flags.venue_map).toBe(true);
    expect(flags.passport).toBe(true);
  });

  it("enables add-on features on top of tier", () => {
    const flags = computeFeatureFlags("essential", ["polls", "feedback"]);
    expect(flags.polls).toBe(true);
    expect(flags.feedback).toBe(true);
    // Still has tier features
    expect(flags.announcements).toBe(true);
  });

  it("ignores add-ons without feature flags (domain, extra_admins)", () => {
    const flags = computeFeatureFlags("essential", ["domain", "extra_admins"]);
    // These add-ons don't have featureFlags, so no change vs base tier
    expect(flags.announcements).toBe(true);
    expect(flags.polls).toBe(false);
  });
});

describe("computeTotalCents", () => {
  it("returns 0 for unknown tier", () => {
    expect(computeTotalCents("nonexistent", [])).toBe(0);
  });

  it("returns tier price with no add-ons", () => {
    expect(computeTotalCents("essential", [])).toBe(29900);
    expect(computeTotalCents("all-in", [])).toBe(49900);
  });

  it("adds add-on prices to tier price", () => {
    const polls = ADD_ONS.find((a) => a.id === "polls")!;
    const feedback = ADD_ONS.find((a) => a.id === "feedback")!;
    expect(computeTotalCents("essential", ["polls", "feedback"])).toBe(
      29900 + polls.priceCents + feedback.priceCents,
    );
  });

  it("ignores unknown add-on IDs", () => {
    expect(computeTotalCents("essential", ["nonexistent"])).toBe(29900);
  });
});

describe("computeLimits", () => {
  it("returns defaults for unknown tier", () => {
    expect(computeLimits("nonexistent", [])).toEqual({
      maxAttendees: 500,
      maxAdmins: 1,
    });
  });

  it("returns essential limits", () => {
    expect(computeLimits("essential", [])).toEqual({
      maxAttendees: 500,
      maxAdmins: 1,
    });
  });

  it("returns all-in limits", () => {
    expect(computeLimits("all-in", [])).toEqual({
      maxAttendees: 2000,
      maxAdmins: 5,
    });
  });

  it("bumps maxAdmins to 5 with extra_admins add-on", () => {
    expect(computeLimits("essential", ["extra_admins"])).toEqual({
      maxAttendees: 500,
      maxAdmins: 5,
    });
  });
});

describe("formatPrice", () => {
  it("formats cents as dollar string without decimals", () => {
    expect(formatPrice(29900)).toBe("$299");
    expect(formatPrice(49900)).toBe("$499");
    expect(formatPrice(4900)).toBe("$49");
    expect(formatPrice(0)).toBe("$0");
  });
});

describe("getIncludedAddonIds", () => {
  it("returns empty for unknown tier", () => {
    expect(getIncludedAddonIds("nonexistent")).toEqual([]);
  });

  it("returns add-ons already included in essential tier", () => {
    const included = getIncludedAddonIds("essential");
    // Essential includes announcements, venue_map, emergency_reporting
    // Only announcements has a matching add-on (there's no venue_map/emergency_reporting add-on)
    // Actually let's check: ADD_ONS have polls, feedback, sponsor_leads, passport, domain, extra_admins
    // Essential includedFeatures: announcements, venue_map, emergency_reporting
    // None of those appear as add-on featureFlags
    expect(included).toEqual([]);
  });

  it("returns add-ons already included in all-in tier", () => {
    const included = getIncludedAddonIds("all-in");
    // All-In includes: polls, emergency_reporting, sponsor_leads, announcements, feedback, venue_map, passport
    // Add-ons with feature flags: polls, feedback, sponsor_leads, passport
    expect(included).toContain("polls");
    expect(included).toContain("feedback");
    expect(included).toContain("sponsor_leads");
    expect(included).toContain("passport");
  });
});

describe("getStripePriceId", () => {
  it("returns the env var value for a known item", () => {
    expect(getStripePriceId("essential")).toBe("price_test_essential");
    expect(getStripePriceId("all-in")).toBe("price_test_all_in");
    expect(getStripePriceId("polls")).toBe("price_test_polls");
  });

  it("converts hyphens to underscores in env var name", () => {
    // all-in → STRIPE_PRICE_ALL_IN
    expect(getStripePriceId("all-in")).toBe("price_test_all_in");
  });

  it("throws for missing env var", () => {
    expect(() => getStripePriceId("nonexistent")).toThrow(
      'Missing env var STRIPE_PRICE_NONEXISTENT for pricing item "nonexistent"',
    );
  });
});
