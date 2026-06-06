import { RequestHandler } from "express";
import Stripe from "stripe";
import { notifyFromWebhook } from "./notifications";

// Server-side car catalogue: prices live ONLY on the server so the
// client cannot manipulate amounts. Edit prices here.
type Plan = "weekly" | "monthly";

interface CarPricing {
  name: string;
  weekly: number; // dollars, charged every week
  monthly: number; // dollars, charged every month
}

const CAR_CATALOG: Record<string, CarPricing> = {
  "1": { name: "Chrysler 200", weekly: 349, monthly: 1199 },
  "2": { name: "Chevy Camaro", weekly: 399, monthly: 1349 },
  "3": { name: "Chevy Tahoe", weekly: 479, monthly: 1599 },
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export const createCheckoutSession: RequestHandler = async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(500).json({
        error:
          "Stripe is not configured. Set STRIPE_SECRET_KEY in your server environment.",
      });
    }

    const {
      carId,
      plan,
      customerEmail,
      customerName,
      phone,
      licenseUrl,
      idUrl,
      originUrl,
    } = req.body as {
      carId?: string;
      plan?: Plan;
      customerEmail?: string;
      customerName?: string;
      phone?: string;
      licenseUrl?: string;
      idUrl?: string;
      originUrl?: string;
    };

    if (!carId || !CAR_CATALOG[carId]) {
      return res.status(400).json({ error: "Invalid carId" });
    }
    if (plan !== "weekly" && plan !== "monthly") {
      return res.status(400).json({ error: "Invalid plan" });
    }
    if (!customerEmail) {
      return res.status(400).json({ error: "customerEmail is required" });
    }

    const car = CAR_CATALOG[carId];
    const amountDollars = plan === "weekly" ? car.weekly : car.monthly;
    const interval: "week" | "month" = plan === "weekly" ? "week" : "month";

    // Build success/cancel URLs from the frontend origin (never hardcoded)
    const origin =
      originUrl ||
      (req.headers.origin as string) ||
      `${req.protocol}://${req.get("host")}`;
    const success_url = `${origin}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${origin}/vehicle/${carId}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${car.name} — ${plan === "weekly" ? "Weekly" : "Monthly"} Rental`,
              description:
                plan === "weekly"
                  ? `Charged $${car.weekly}/week until canceled`
                  : `Charged $${car.monthly}/month until canceled`,
            },
            unit_amount: Math.round(amountDollars * 100), // cents
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      metadata: {
        carId,
        carName: car.name,
        plan,
        customerName: customerName || "",
        phone: phone || "",
        licenseUrl: licenseUrl || "",
        idUrl: idUrl || "",
      },
      subscription_data: {
        metadata: {
          carId,
          carName: car.name,
          plan,
          customerName: customerName || "",
          phone: phone || "",
        },
      },
      success_url,
      cancel_url,
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("[stripe] create-checkout-session error:", err?.message || err);
    return res
      .status(500)
      .json({ error: err?.message || "Failed to create checkout session" });
  }
};

export const getCheckoutStatus: RequestHandler = async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.json({
      status: session.status, // open | complete | expired
      payment_status: session.payment_status, // paid | unpaid | no_payment_required
      customer_email: session.customer_details?.email || null,
      amount_total: session.amount_total,
      currency: session.currency,
      metadata: session.metadata,
    });
  } catch (err: any) {
    console.error("[stripe] get-checkout-status error:", err?.message || err);
    return res
      .status(500)
      .json({ error: err?.message || "Failed to fetch session" });
  }
};

// Webhook handler. Mounted with express.raw({type:'application/json'}) in server/index.ts
export const stripeWebhook: RequestHandler = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(500).send("Stripe not configured");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig as string,
        webhookSecret,
      );
    } else {
      // No secret configured yet — parse without verification (dev only).
      // In production you MUST set STRIPE_WEBHOOK_SECRET.
      event = JSON.parse((req.body as Buffer).toString("utf8")) as Stripe.Event;
      console.warn(
        "[stripe webhook] STRIPE_WEBHOOK_SECRET not set — signature NOT verified",
      );
    }
  } catch (err: any) {
    console.error("[stripe webhook] signature verification failed:", err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }

  // Log relevant events. Manual approval workflow — no DB writes here.
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(
        "[stripe webhook] checkout.session.completed",
        session.id,
        session.customer_email,
        session.metadata,
      );
      // Fire-and-forget: send the Formspree application email + log it.
      // notifyFromWebhook is dedup'd by session.id so it's safe.
      void notifyFromWebhook(session);
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
    case "customer.subscription.deleted":
      console.log(`[stripe webhook] ${event.type}`, (event.data.object as any)?.id);
      break;
    default:
      // ignore other events
      break;
  }

  return res.json({ received: true });
};

// Expose pricing so frontend stays in sync without duplicating amounts in code.
export const getCarPricing: RequestHandler = (_req, res) => {
  res.json(CAR_CATALOG);
};
