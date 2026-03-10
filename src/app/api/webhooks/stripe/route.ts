import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionEvent } from "@/lib/provisioning";
import type { Order } from "@/lib/types";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET env var");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Find the order by checkout session ID
      const { data: order, error } = await admin
        .from("orders")
        .select("*")
        .eq("stripe_checkout_session_id", session.id)
        .single();

      if (error || !order) {
        console.error("Order not found for session:", session.id);
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      // Skip if already provisioned
      if (order.status === "completed") {
        return NextResponse.json({ received: true });
      }

      // Update payment intent ID
      await admin
        .from("orders")
        .update({
          stripe_payment_intent_id: typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        })
        .eq("id", order.id);

      try {
        await provisionEvent(order as Order);
      } catch (err) {
        console.error("Provisioning failed:", err);

        await admin
          .from("orders")
          .update({ status: "failed" })
          .eq("id", order.id);

        return NextResponse.json(
          { error: "Provisioning failed" },
          { status: 500 },
        );
      }

      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;

      await admin
        .from("orders")
        .update({ status: "expired" })
        .eq("stripe_checkout_session_id", session.id)
        .eq("status", "pending");

      break;
    }

    default:
      // Unhandled event type — acknowledge receipt
      break;
  }

  return NextResponse.json({ received: true });
}
