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
import {
  uploadHandler,
  uploadMiddleware,
  notifyHandler,
} from "./routes/notifications";

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

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));

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

  // Cloudinary uploads + Formspree notifications
  app.post("/api/upload", uploadMiddleware, uploadHandler);
  app.post("/api/notify/:sessionId", notifyHandler);

  return app;
}
