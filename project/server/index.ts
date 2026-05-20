import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  createCheckoutSession,
  getCheckoutStatus,
  stripeWebhook,
  getCarPricing,
} from "./routes/stripe";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());

  // Stripe webhook MUST be registered BEFORE express.json() so we get the raw body
  app.post(
    "/api/stripe-webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Stripe Checkout (subscriptions: weekly or monthly)
  app.post("/api/create-checkout-session", createCheckoutSession);
  app.get("/api/checkout-status/:sessionId", getCheckoutStatus);
  app.get("/api/cars", getCarPricing);

  return app;
}
