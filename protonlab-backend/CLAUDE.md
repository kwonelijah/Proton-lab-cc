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
| `api/admin.js` | Dispatch admin page (`?key=proton_export_key`) — sends dispatch email, schedules thank-you (+5 days), stamps PaymentIntent metadata. `&format=json` mode feeds the local order dashboard's Web Shop tab (CORS open; auth via key). POST `{action:'production', club}` emails all un-notified customers of a club that their order is in production. POST `{action:'send', kind, order, tracking?}` sends lifecycle emails for dashboard-managed manual (non-Stripe) orders (`order.shippingMethod` — `standard` / `next-day` / `international` — picks the delivery wording). The dispatch POST `{pi, tracking, service?}` accepts the same `service` keys to override the checkout choice; it's stamped as `shipping_method` so the feed and Evri export agree |
| `api/export-evri.js` | Evri bulk-despatch CSV export, read from Stripe (`?key=proton_export_key`) |
| `api/stock-sync.js` | Nightly stock sync (Vercel cron 20:00 UTC) — tallies un-synced paid orders from PI `metadata.items`, commits decremented `inventory/stock.csv` to the website repo via GitHub API, stamps PIs `stock_synced`. `?dryRun=1&key=...` for a report-only run |
| `lib/clubs.js` | Reads `data/clubs.ts` from the website repo (via `lib/stock.js` `readRepoFile`) and extracts club-shop handle / name / password / url — served by `api/admin.js` `?action=clubs` for the dashboard's order editor |
| `lib/stock.js` | All stock CSV + GitHub Contents API logic. Quantity-only invariant: never adds/removes/renames rows, so a commit can never break the site build. Signed-delta movements, clamp at 0, skip unknown handle::size (club kit), 3× sha-conflict retry |
| `api/checkout-session.js` | Non-PII order summary (value/currency/handles) for a paid session — the frontend `/success` page uses it to fire the browser Meta Purchase event |
| `lib/meta-capi.js` | Meta Conversions API sender — hashed user data + attribution; used by webhook for server-side Purchase events |
| `emails/theme.js` | Email design system — brand palette/type/layout, shared by all customer emails |
| `emails/order-*.js` | Customer email templates: confirmation, dispatched, delivered thank-you |
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
| `META_PIXEL_ID` | Meta pixel/dataset ID (Events Manager) — Conversions API events |
| `META_CAPI_ACCESS_TOKEN` | Meta Conversions API access token (Events Manager → pixel Settings) |
| `META_TEST_EVENT_CODE` | Optional — routes CAPI events to Test Events while set; remove in production |
| `GITHUB_TOKEN` | Fine-grained PAT, Contents R/W on `kwonelijah/Proton-lab-cc` only — stock.csv commits |
| `CRON_SECRET` | Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron invocations of `/api/stock-sync` |
| `STOCK_SYNC_EMAIL` | Optional — nightly stock-sync summary email recipient (e.g. `info@protonlab.cc`) |

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

