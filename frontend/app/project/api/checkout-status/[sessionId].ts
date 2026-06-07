import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCheckoutStatus } from "../../server/routes/stripe";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await new Promise<void>((resolve) => {
    getCheckoutStatus(req as any, res as any, () => resolve());
  });
}
