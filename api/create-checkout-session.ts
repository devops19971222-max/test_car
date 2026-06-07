import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createCheckoutSession } from "../frontend/app/project/server/routes/stripe";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await new Promise<void>((resolve) => {
    createCheckoutSession(req as any, res as any, () => resolve());
  });
}
