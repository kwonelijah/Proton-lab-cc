# ProtonLab Backend — Setup Guide

## What this does

Every time a customer pays on protonlab.cc via Stripe Hosted Checkout, this backend:
1. Creates a Stripe Checkout session and redirects the customer to pay
2. Catches the completed payment event via webhook
3. Writes the order to your Google Sheet
4. Runs a Claude agent to flag duplicates or suspicious orders automatically

---

## Deployment flow (Claude Code → GitHub → Vercel)

This repo is structured to work with Claude Code pushing to GitHub, which then auto-deploys to Vercel via GitHub Actions.

```
You → Claude Code → GitHub (main branch) → GitHub Actions → Vercel (live)
```

**One-time setup steps before Claude Code can deploy:**

### 1. Create the GitHub repo

```bash
gh repo create protonlab-backend --private
git init
git remote add origin https://github.com/YOUR_USERNAME/protonlab-backend.git
```

### 2. Do one manual Vercel deploy first (generates project IDs)

```bash
npm install
npx vercel
# Follow prompts — link to your existing Vercel account
# This creates .vercel/project.json with your ORG_ID and PROJECT_ID
```

### 3. Add secrets to GitHub

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these three:

| Secret name | Where to find it |
|---|---|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create token |
| `VERCEL_ORG_ID` | Inside `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | Inside `.vercel/project.json` → `projectId` |

### 4. Add env variables to Vercel

Go to your Vercel project → **Settings → Environment Variables** and add all values from `.env.example`:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `ANTHROPIC_API_KEY`
- `SITE_URL` (e.g. `https://protonlab.cc`)

After this, every `git push` to `main` deploys automatically. Claude Code just pushes and it's live.

---

## Google Sheet setup

1. Create a new Google Sheet named **ProtonLab Orders**
2. Rename the first tab to `Orders`
3. Add these exact headers in row 1:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| ID | Amount | Currency | Email | Name | Product | Date | Status | Notes |

4. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/**THIS_PART**/edit`

---

## Google Cloud setup (5 min)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project
2. **APIs & Services → Enable APIs** → enable **Google Sheets API**
3. **IAM & Admin → Service Accounts → Create Service Account** (name it anything)
4. Click the service account → **Keys → Add Key → JSON** → download file
5. Copy the `client_email` from the JSON (looks like `name@project.iam.gserviceaccount.com`)
6. Share your Google Sheet with that email as **Editor**
7. Paste the entire JSON contents as the `GOOGLE_SERVICE_ACCOUNT_JSON` env variable

---

## Stripe setup

1. Create account at [stripe.com](https://stripe.com)
2. In **Developers → Webhooks → Add endpoint**:
   - URL: `https://your-vercel-project.vercel.app/api/webhook`
   - Event: `payment_intent.succeeded`
3. Copy the **Signing secret** (`whsec_...`) → add as `STRIPE_WEBHOOK_SECRET`
4. Get your **Secret key** (`sk_live_...`) → add as `STRIPE_SECRET_KEY`

---

## Frontend integration

Add `frontend-snippet.js` logic to protonlab.cc. When a customer clicks Buy:

```javascript
// Single product
handleCheckout([
  { name: 'ProtonLab Kit', price: 4999, quantity: 1 }
]);

// Multiple products (cart)
handleCheckout(cartItems);
```

Update the fetch URL in `frontend-snippet.js` to point to your Vercel deployment URL.

---

## File structure

```
protonlab-backend/
├── .github/
│   └── workflows/
│       └── deploy.yml              ← auto-deploys on push to main
├── api/
│   ├── webhook.js                  ← Stripe webhook (receives payment events)
│   └── create-checkout-session.js  ← creates Stripe Hosted Checkout session
├── lib/
│   ├── sheets.js                   ← Google Sheets read/write helpers
│   └── agent.js                    ← Claude agent for order processing
├── frontend-snippet.js             ← paste into protonlab.cc frontend
├── .env.example                    ← copy to .env, fill in keys (never commit .env)
├── .gitignore
├── vercel.json
└── package.json
```

---

## Cost summary (per month at low volume)

| Service | Cost |
|---|---|
| Stripe | 2.9% + $0.30 per order |
| Vercel | Free |
| Google Sheets API | Free |
| Claude API (agent) | ~$0.001–0.01 per order |
| GitHub | Free (private repo) |
| **Fixed monthly** | **$0** |
