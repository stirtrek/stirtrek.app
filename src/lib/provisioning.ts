import { createAdminClient } from "@/lib/supabase/admin";
import { computeFeatureFlags, computeLimits, ADD_ONS } from "@/lib/pricing";
import type { Order } from "@/lib/types";

/**
 * Provision a new event from a completed order.
 * - Creates the event with computed feature flags
 * - Creates an admin membership for the purchaser
 * - Updates the order with the new event ID and status
 */
export async function provisionEvent(order: Order): Promise<{ eventId: string; slug: string }> {
  const admin = createAdminClient();

  const featureFlags = computeFeatureFlags(order.tier_id, order.addon_ids);
  const { maxAttendees, maxAdmins } = computeLimits(order.tier_id, order.addon_ids);

  // Check if custom domain add-on was purchased
  const hasDomain = order.addon_ids.some((id) => {
    const addon = ADD_ONS.find((a) => a.id === id);
    return addon?.capability === "domain";
  });

  // Create the event
  const { data: event, error: eventError } = await admin
    .from("events")
    .insert({
      name: order.event_name,
      slug: order.event_slug,
      event_date: order.event_date || null,
      event_end_date: order.event_end_date || null,
      venue_name: order.venue_name || null,
      timezone: order.timezone,
      feature_flags: featureFlags,
      is_active: true,
      show_on_marketing: false,
      order_id: order.id,
      stripe_customer_id: order.stripe_customer_id,
      max_attendees: maxAttendees,
      max_admins: maxAdmins,
      accent_color: "#0ea5e9", // default sky blue
      // domain will be configured later if purchased
    })
    .select("id, slug")
    .single();

  if (eventError || !event) {
    throw new Error(`Failed to create event: ${eventError?.message ?? "Unknown error"}`);
  }

  // Create admin membership for the purchaser
  const { error: membershipError } = await admin
    .from("event_memberships")
    .insert({
      event_id: event.id,
      user_id: order.user_id,
      role: "admin",
      is_sponsor: false,
    });

  if (membershipError) {
    // Non-fatal: log but don't fail provisioning
    console.error("Failed to create admin membership:", membershipError.message);
  }

  // Update order with event ID and mark completed
  const { error: orderError } = await admin
    .from("orders")
    .update({
      event_id: event.id,
      status: "completed",
    })
    .eq("id", order.id);

  if (orderError) {
    console.error("Failed to update order:", orderError.message);
  }

  // Update profile with stripe_customer_id if not already set
  if (order.stripe_customer_id) {
    await admin
      .from("profiles")
      .update({ stripe_customer_id: order.stripe_customer_id })
      .eq("id", order.user_id)
      .is("stripe_customer_id", null);
  }

  return { eventId: event.id, slug: event.slug };
}
