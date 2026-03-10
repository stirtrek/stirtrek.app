import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { TIERS, ADD_ONS, computeTotalCents, getStripePriceId } from "@/lib/pricing";

export async function POST(request: NextRequest) {
  // Require auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    tier_id: string;
    addon_ids: string[];
    event_name: string;
    event_slug: string;
    event_date?: string;
    event_end_date?: string;
    venue_name?: string;
    timezone?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tier_id, addon_ids, event_name, event_slug, event_date, event_end_date, venue_name, timezone } = body;

  // Validate required fields
  if (!tier_id || !event_name || !event_slug) {
    return NextResponse.json(
      { error: "tier_id, event_name, and event_slug are required" },
      { status: 400 },
    );
  }

  // Validate tier
  const tier = TIERS.find((t) => t.id === tier_id);
  if (!tier) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(event_slug)) {
    return NextResponse.json(
      { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
      { status: 400 },
    );
  }

  // Check slug uniqueness
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("events")
    .select("id")
    .eq("slug", event_slug)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "An event with this slug already exists" },
      { status: 409 },
    );
  }

  // Also check pending orders for this slug
  const { data: pendingOrder } = await admin
    .from("orders")
    .select("id")
    .eq("event_slug", event_slug)
    .eq("status", "pending")
    .single();

  if (pendingOrder) {
    return NextResponse.json(
      { error: "An event with this slug is being created" },
      { status: 409 },
    );
  }

  // Validate add-ons
  const validAddonIds = (addon_ids || []).filter((id: string) =>
    ADD_ONS.some((a) => a.id === id),
  );

  // Calculate total
  const amountCents = computeTotalCents(tier_id, validAddonIds);

  // Get or create Stripe customer
  const stripe = getStripe();
  let stripeCustomerId: string;

  // Check if user already has a Stripe customer ID
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_customer_id) {
    stripeCustomerId = profile.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: user.email || profile?.email,
      metadata: { user_id: user.id },
    });
    stripeCustomerId = customer.id;

    await admin
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", user.id);
  }

  // Build line items
  const lineItems: { price: string; quantity: number }[] = [
    { price: getStripePriceId(tier_id), quantity: 1 },
  ];

  for (const addonId of validAddonIds) {
    lineItems.push({ price: getStripePriceId(addonId), quantity: 1 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "payment",
    line_items: lineItems,
    success_url: `${appUrl}/create-event/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/create-event/review`,
    metadata: {
      user_id: user.id,
      event_name,
      event_slug,
      tier_id,
      addon_ids: JSON.stringify(validAddonIds),
    },
    expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
  });

  // Create pending order
  const { error: orderError } = await admin.from("orders").insert({
    user_id: user.id,
    stripe_checkout_session_id: session.id,
    stripe_customer_id: stripeCustomerId,
    tier_id,
    addon_ids: validAddonIds,
    amount_cents: amountCents,
    currency: "usd",
    event_name,
    event_slug,
    event_date: event_date || null,
    event_end_date: event_end_date || null,
    venue_name: venue_name || null,
    timezone: timezone || "America/New_York",
    status: "pending",
  });

  if (orderError) {
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }

  return NextResponse.json({ checkout_url: session.url });
}
