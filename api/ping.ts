import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const message = process.env.PING_MESSAGE ?? "ping";
  res.status(200).json({ message });
}
