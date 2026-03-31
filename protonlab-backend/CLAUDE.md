# ProtonLab Backend — Claude Code Guide

## What this project is

Payment and order processing backend for protonlab.cc. When a customer pays via Stripe Hosted Checkout, this backend catches the webhook, writes the order to a Google Sheet, and runs a Claude agent to flag duplicates or suspicious orders automatically.

## Deployment

This project auto-deploys to Vercel on every push to `main` via GitHub Actions. Claude Code should:
- Make changes to files in this repo
- Commit to `main`
- Push — Vercel handles the rest automatically

Never run `vercel` manually. Never edit environment variables in code — they live in Vercel's dashboard.

## Architecture

```
protonlab.cc frontend
    ↓ POST /api/create-checkout-session
Vercel serverless function
    ↓ returns Stripe checkout URL
Customer pays on Stripe hosted page
    ↓ Stripe sends webhook
/api/webhook (Vercel function)
    ↓
lib/sheets.js  →  Google Sheet (writes new order row)
lib/agent.js   →  Claude API (flags/processes order, updates sheet)
```

## File map

| File | Purpose |
|---|---|
| `api/webhook.js` | Receives Stripe payment events, orchestrates sheet write + agent |
| `api/create-checkout-session.js` | Creates Stripe Hosted Checkout session for frontend |
| `lib/sheets.js` | All Google Sheets read/write logic |
| `lib/agent.js` | Claude agent — processes orders, flags issues, writes status back |
| `frontend-snippet.js` | Paste into protonlab.cc to trigger checkout |
| `vercel.json` | Vercel config — do not change maxDuration without reason |
| `.github/workflows/deploy.yml` | CI/CD — deploys on push to main |

## Environment variables

Never hardcode these. They live in Vercel dashboard → Settings → Environment Variables.

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `GOOGLE_SHEET_ID` | ID from Google Sheet URL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON contents of Google service account key |
| `ANTHROPIC_API_KEY` | Claude API key for the agent |
| `SITE_URL` | `https://protonlab.cc` — used for Stripe redirect URLs |

## Google Sheet structure

Tab must be named `Orders`. Headers in row 1, columns A–I:

```
ID | Amount | Currency | Email | Name | Product | Date | Status | Notes
```

The agent writes to Status (col H) and Notes (col I) automatically.

## Key conventions

- All monetary amounts from Stripe are in **cents** — divide by 100 for dollars
- Stripe webhook endpoint must have `bodyParser: false` (raw body required for signature verification)
- The agent responds with a JSON array — always parse `response.content[0].text`
- Google auth uses a service account — credentials are in `GOOGLE_SERVICE_ACCOUNT_JSON` env var as a JSON string

## Common tasks for Claude Code

**Add a new product or price:**
Update `frontend-snippet.js` with the new product name and price in cents.

**Change order statuses the agent can assign:**
Edit the prompt in `lib/agent.js` — the status values are defined there in plain English.

**Add a new column to the sheet:**
1. Update the `COLUMNS` array in `lib/sheets.js`
2. Update `appendOrder()` to include the new field
3. Add the column header manually in the Google Sheet

**Add a success/cancel page:**
Create `api/success.js` and `api/cancel.js` as Vercel functions, or handle on the protonlab.cc frontend.

## What NOT to do

- Do not commit `.env` — it's in `.gitignore`
- Do not change `SITE_URL` in code — update it in Vercel dashboard
- Do not use `bodyParser: true` on the webhook endpoint
- Do not modify `.github/workflows/deploy.yml` unless changing the deployment strategy
