export const APP_NAME = "Stir Trek 2026";
export const APP_DESCRIPTION = "Stir Trek Conference - Day-of Attendee App";
export const EVENT_DATE = "2026-05-01";
export const VENUE_NAME = "AMC Easton Town Center 30";
export const VENUE_ADDRESS = "275 Easton Town Ctr, Columbus, OH 43219";

export const FEEDBACK_RATINGS = {
  green: { label: "Great", color: "#22c55e" },
  yellow: { label: "Okay", color: "#eab308" },
  red: { label: "Poor", color: "#ef4444" },
} as const;

export const EMERGENCY_CATEGORIES = {
  person_safety: { label: "Person Safety", icon: "ShieldAlert" },
  av_problem: { label: "A/V Problem", icon: "Monitor" },
  facility_issue: { label: "Facility Issue", icon: "Building" },
  medical: { label: "Medical", icon: "Heart" },
  other: { label: "Other", icon: "AlertCircle" },
} as const;

export const SPONSOR_TIER_ORDER = [
  "platinum",
  "gold",
  "silver",
  "bronze",
  "community",
] as const;

export const NAV_ITEMS = [
  { href: "/schedule", label: "Schedule", icon: "Calendar" },
  { href: "/speakers", label: "Speakers", icon: "Users" },
  { href: "/sponsors", label: "Sponsors", icon: "Building2" },
  { href: "/polls", label: "Polls", icon: "BarChart3" },
  { href: "/more", label: "More", icon: "Menu" },
] as const;
