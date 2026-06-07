import type { VercelRequest, VercelResponse } from "@vercel/node";
import { stripeWebhook } from "../frontend/app/project/server/routes/stripe";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  await new Promise<void>((resolve) => {
    stripeWebhook(req as any, res as any, () => resolve());
  });
}
