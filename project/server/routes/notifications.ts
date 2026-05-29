import { RequestHandler } from "express";
import multer from "multer";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import Stripe from "stripe";
import { promises as fs } from "fs";
import path from "path";

// ──────────────────────────────────────────────────────────────────────────
// Cloudinary configuration (server-side, uses API secret)
// ──────────────────────────────────────────────────────────────────────────
function configureCloudinary() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    return false;
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return true;
}

// Multer with in-memory storage so we can stream straight to Cloudinary
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
}).fields([
  { name: "license", maxCount: 1 },
  { name: "id", maxCount: 1 },
]);

function uploadBufferToCloudinary(
  buffer: Buffer,
  publicIdPrefix: string,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "carnextdrive-applications",
        public_id: publicIdPrefix,
        resource_type: "auto",
        overwrite: false,
      },
      (err, result) => {
        if (err || !result) return reject(err || new Error("upload failed"));
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

export const uploadHandler: RequestHandler = async (req, res) => {
  try {
    if (!configureCloudinary()) {
      return res.status(500).json({
        error:
          "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.",
      });
    }

    const files = req.files as
      | { [field: string]: Express.Multer.File[] }
      | undefined;
    const licenseFile = files?.license?.[0];
    const idFile = files?.id?.[0];

    if (!licenseFile && !idFile) {
      return res.status(400).json({ error: "No files provided" });
    }

    const stamp = Date.now();
    let licenseUrl: string | null = null;
    let idUrl: string | null = null;

    if (licenseFile) {
      const r = await uploadBufferToCloudinary(
        licenseFile.buffer,
        `license-${stamp}`,
      );
      licenseUrl = r.secure_url;
    }
    if (idFile) {
      const r = await uploadBufferToCloudinary(idFile.buffer, `id-${stamp}`);
      idUrl = r.secure_url;
    }

    return res.json({ licenseUrl, idUrl });
  } catch (err: any) {
    console.error("[upload] error:", err?.message || err);
    return res
      .status(500)
      .json({ error: err?.message || "Upload failed" });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Formspree application notification — sent from the server after successful
// Stripe payment. Dedup'd so the same session is never emailed twice.
// ──────────────────────────────────────────────────────────────────────────
const notifiedSessions = new Set<string>();

const DATA_DIR = "/app/project/.data";
const LOG_PATH = path.join(DATA_DIR, "applications.jsonl");

async function appendApplicationLog(payload: Record<string, any>) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(
      LOG_PATH,
      JSON.stringify({ ts: new Date().toISOString(), ...payload }) + "\n",
      "utf8",
    );
  } catch (err) {
    console.warn("[notify] failed to append local log:", err);
  }
}

interface StripeSessionSummary {
  sessionId: string;
  customerEmail: string;
  customerName: string;
  phone: string;
  carId: string;
  carName: string;
  plan: string;
  selectedPrice: string;
  licenseUrl: string;
  idUrl: string;
  amountPaid: string;
  currency: string;
  stripeCustomerId: string;
  subscriptionId: string;
}

/**
 * Pulls every relevant field from a Stripe Checkout Session and the
 * resulting subscription so we can ship it off to Formspree.
 */
async function summarizeSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<StripeSessionSummary> {
  const md = session.metadata || {};
  let subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || "";

  return {
    sessionId: session.id,
    customerEmail:
      session.customer_details?.email || session.customer_email || "",
    customerName: md.customerName || session.customer_details?.name || "",
    phone: md.phone || session.customer_details?.phone || "",
    carId: md.carId || "",
    carName: md.carName || "",
    plan: md.plan || "",
    selectedPrice:
      md.plan === "weekly"
        ? `$${(session.amount_total ?? 0) / 100} / week`
        : md.plan === "monthly"
          ? `$${(session.amount_total ?? 0) / 100} / month`
          : `${(session.amount_total ?? 0) / 100} ${session.currency || ""}`,
    licenseUrl: md.licenseUrl || "",
    idUrl: md.idUrl || "",
    amountPaid: ((session.amount_total ?? 0) / 100).toFixed(2),
    currency: (session.currency || "").toUpperCase(),
    stripeCustomerId:
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || "",
    subscriptionId: subId,
  };
}

async function sendFormspree(
  summary: StripeSessionSummary,
): Promise<{ ok: boolean; status: number; body: string }> {
  const endpoint = process.env.FORMSPREE_ENDPOINT;
  if (!endpoint) {
    return { ok: false, status: 0, body: "FORMSPREE_ENDPOINT not set" };
  }

  // Formspree accepts JSON when Accept: application/json is set. The keys
  // below become the column headers in your Formspree submissions table.
  const payload = {
    _subject: `New CarNextDrive application — ${summary.carName} (${summary.plan})`,
    _replyto: summary.customerEmail,
    fullName: summary.customerName,
    email: summary.customerEmail,
    phone: summary.phone,
    selectedCar: summary.carName,
    plan: summary.plan,
    selectedPrice: summary.selectedPrice,
    amountPaid: `${summary.amountPaid} ${summary.currency}`,
    licenseUrl: summary.licenseUrl || "(no file uploaded)",
    idUrl: summary.idUrl || "(no file uploaded)",
    stripeSessionId: summary.sessionId,
    stripeCustomerId: summary.stripeCustomerId,
    stripeSubscriptionId: summary.subscriptionId,
  };

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await r.text().catch(() => "");
  return { ok: r.ok, status: r.status, body };
}

/**
 * Reusable handler: takes a Stripe session, sends Formspree, logs locally,
 * marks session as notified. Safe to call multiple times — only the first
 * call actually does the work.
 */
async function notifyForSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<{ skipped: boolean; ok: boolean; detail: string }> {
  if (notifiedSessions.has(session.id)) {
    return { skipped: true, ok: true, detail: "already notified" };
  }
  // Only notify for sessions that actually completed and paid.
  if (
    session.status !== "complete" ||
    (session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required")
  ) {
    return {
      skipped: true,
      ok: false,
      detail: `not paid yet (status=${session.status}, payment_status=${session.payment_status})`,
    };
  }

  const summary = await summarizeSession(stripe, session);

  await appendApplicationLog(summary);

  const fr = await sendFormspree(summary);
  if (!fr.ok) {
    console.error(
      "[notify] Formspree failed:",
      fr.status,
      fr.body.slice(0, 300),
    );
    // Still mark as notified so we don't hammer Formspree; the local log
    // has the record so you can re-send manually if needed.
    notifiedSessions.add(session.id);
    return {
      skipped: false,
      ok: false,
      detail: `formspree returned ${fr.status}: ${fr.body.slice(0, 200)}`,
    };
  }

  notifiedSessions.add(session.id);
  console.log("[notify] Formspree sent for session", session.id);
  return { skipped: false, ok: true, detail: "sent" };
}

// Exposed so the Stripe webhook can call it without an HTTP round-trip.
export async function notifyFromWebhook(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return;
  const stripe = new Stripe(key);
  try {
    // The session payload Stripe sends in the webhook is usually enough,
    // but we re-fetch it to get the latest payment_status, customer
    // details, etc.
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["subscription", "customer"],
    });
    const result = await notifyForSession(stripe, full);
    console.log("[notify] webhook result:", result);
  } catch (err: any) {
    console.error("[notify] webhook handler error:", err?.message || err);
  }
}

/**
 * Fallback endpoint called by the /success page after the customer lands
 * back from Stripe. Lets the email fire immediately even if the webhook
 * hasn't been set up in the Stripe Dashboard yet.
 */
export const notifyHandler: RequestHandler = async (req, res) => {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return res.status(500).json({ error: "Stripe not configured" });
    const stripe = new Stripe(key);

    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const result = await notifyForSession(stripe, session);
    return res.json(result);
  } catch (err: any) {
    console.error("[notify] handler error:", err?.message || err);
    return res
      .status(500)
      .json({ error: err?.message || "notify failed" });
  }
};
