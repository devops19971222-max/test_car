# Deploy CarNextDrive to Vercel — Step by Step

Deploy **frontend + Node API** in one Vercel project. You do **not** need
`backend/server.py` (that is Emergent-only).

---

## Prerequisites

- [ ] GitHub account with this repo pushed
- [ ] [Vercel account](https://vercel.com) (free tier works)
- [ ] Stripe account (test keys to start)
- [ ] Node 20+ locally (for testing)

---

## Step 1 — Push code to GitHub

If not already on GitHub:

```bash
cd carnextdrive-production
git add .
git commit -m "Add Vercel deployment config"
git push origin main
```

---

## Step 2 — Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your GitHub repo
3. On the configure screen, set:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend/app/project` |
| **Framework Preset** | Other |
| **Build Command** | `npm run build:client` |
| **Output Directory** | `dist/spa` |
| **Install Command** | `npm install` |

> Root Directory is critical. Do **not** deploy from the repo root.

4. Do **not** deploy yet — add env vars first (Step 3).

---

## Step 3 — Add environment variables

In Vercel → **Project → Settings → Environment Variables**, add:

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `STRIPE_SECRET_KEY` | **Yes** | `sk_test_…` from Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Production | `whsec_…` (Step 6) |
| `FORMSPREE_ENDPOINT` | Optional | `https://formspree.io/f/xxxxx` |
| `CLOUDINARY_CLOUD_NAME` | Optional | Server-side uploads |
| `CLOUDINARY_API_KEY` | Optional | Server-side uploads |
| `CLOUDINARY_API_SECRET` | Optional | Server-side uploads |
| `PUBLIC_SITE_URL` | Optional | `https://your-app.vercel.app` |

Apply to **Production**, **Preview**, and **Development**.

---

## Step 4 — Deploy

1. Click **Deploy**
2. Wait for the build to finish (~1–2 min)
3. Open your site: `https://your-project.vercel.app`

### Quick smoke tests

```bash
# API health
curl https://your-project.vercel.app/api/ping

# Should return: {"message":"ping"}
```

Open the site in a browser and confirm the homepage loads.

---

## Step 5 — Update Stripe webhook

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. **Endpoint URL:**
   ```
   https://your-project.vercel.app/api/stripe-webhook
   ```
3. **Events to send:**
   - `checkout.session.completed` (required)
   - `invoice.payment_succeeded` (optional)
   - `invoice.payment_failed` (optional)
   - `customer.subscription.deleted` (optional)
4. Copy the **Signing secret** (`whsec_…`)
5. Add it in Vercel as `STRIPE_WEBHOOK_SECRET`
6. **Redeploy** (Deployments → … → Redeploy) so the new env var loads

---

## Step 6 — Test the booking flow

1. Open a vehicle page → choose Weekly or Monthly
2. Click **Book This Car** → fill the signup form
3. Upload license + ID photos
4. Submit → Stripe Checkout opens
5. Pay with test card: `4242 4242 4242 4242`, any future date, any CVC
6. You should land on `/success` with the confirmation message

### If something fails

| Symptom | Likely fix |
|---------|------------|
| "Stripe is not configured" | Set `STRIPE_SECRET_KEY` in Vercel, redeploy |
| Upload failed | Check Cloudinary preset `carnextdrive-uploads` on cloud `drlo4xvo8` |
| Success page error | API not reachable — check `/api/ping` |
| No application email | Set `FORMSPREE_ENDPOINT` |

Check **Vercel → Deployments → Functions** logs for API errors.

---

## Step 7 — Custom domain (optional)

1. Vercel → **Project → Settings → Domains**
2. Add your domain (e.g. `carnextdrive.com`)
3. Update DNS per Vercel instructions
4. Update Stripe webhook URL to the custom domain
5. Set `PUBLIC_SITE_URL` to your custom domain
6. Redeploy

---

## What gets deployed

```
Vercel project (root: frontend/app/project)
├── dist/spa/          ← React frontend (static)
└── api/[...path].ts   ← Express API (/api/*)
```

**Not deployed:**

- `backend/server.py` — Emergent Python wrapper only
- `frontend/package.json` — Emergent wrapper only

---

## Local dev (unchanged)

```bash
cd frontend/app/project
cp .env.example .env   # add your Stripe test key
npm run dev
```

App runs at http://localhost:3000 with API embedded.

---

## Going live

1. Stripe Dashboard → switch to **Live mode**
2. Replace `STRIPE_SECRET_KEY` with `sk_live_…`
3. Create a **live** webhook endpoint (same URL, live mode)
4. Update `STRIPE_WEBHOOK_SECRET` with the live signing secret
5. Redeploy
