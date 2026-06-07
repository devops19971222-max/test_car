import type { VercelRequest, VercelResponse } from "@vercel/node";
import { notifyHandler } from "../../server/routes/notifications";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await new Promise<void>((resolve) => {
    notifyHandler(req as any, res as any, () => resolve());
  });
}
