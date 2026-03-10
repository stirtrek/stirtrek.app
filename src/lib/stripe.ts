import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Returns a singleton Stripe client (server-side only).
 * Uses the same lazy-init pattern as createAdminClient().
 */
export function getStripe(): Stripe {
  if (!cached) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY env var");
    }
    cached = new Stripe(key);
  }
  return cached;
}
