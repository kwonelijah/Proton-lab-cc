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
| `api/create-checkout-session.js` | Creates Stripe Hosted Checkout session for frontend. Carts made up entirely of items from a club in `config/shipping.js` `CLUB_DELIVERY_CLUBS` (kit goes to the club's distributor in one consignment) collect no address and charge no delivery; the PaymentIntent is stamped `delivery: 'club'`, the webhook records `shipping_method: 'club'`, and the emails, admin feed, dashboard and Evri export (which skips them) all read that key. Add a club there — and flag it `centralDelivery: true` in the website's `data/clubs.ts` — when its shop is set up with central distribution. A club in `COLLECTION_OPTION_CLUBS` (flag `collectionOption: true` in `data/clubs.ts`) instead lets the member choose in the cart: the request's `delivery: 'collection'` takes the same no-address/no-charge path and is stamped `delivery: 'collection'` → `shipping_method: 'collection'`, labelled `COLLECTION_LABEL` ("Collection from committee") in emails, admin feed and dashboard, and skipped by the Evri export; anything else posts at the zone rates. `npm run audit:stripe` (website repo) checks both lists match the `data/clubs.ts` flags. **Analytics metadata (2026-11-01):** every session also stamps `channel` ('retail'/'club' — same rule as the webhook), `club_id` (first club handle), `sku` (first line `handle/size`), `utm_source`/`utm_medium`/`utm_campaign`/`referrer` (from the site's `lib/attribution.ts`, sent as `attribution` in the body; latest campaign click wins, 30-day memory, fbclid → facebook/paid-social) and `attributed:'1'` (the browser sent attribution at all — so no utm = "Direct", while pre-build orders with no key = "Unattributed"); a compact copy (`channel`, `club_id`, `club`, `utm_*`) goes on the Checkout Session's own `metadata`, which was previously never set. Stripe caps a metadata object at 50 keys — the PI carries ~24 at checkout + up to 11 more `items_N` chunks + the webhook/admin stamps, so add keys sparingly |
| `api/admin.js` | Dispatch admin page (`?key=proton_export_key`) — sends dispatch email, schedules thank-you (+5 days), stamps PaymentIntent metadata. `&format=json` mode feeds the local order dashboard's Web Shop tab (CORS open; auth via key). POST `{action:'production', club}` emails all un-notified customers of a club that their order is in production. POST `{action:'send', kind, order, tracking?}` sends lifecycle emails for dashboard-managed manual (non-Stripe) orders (`kind:'sample'` sends emails/sample-dispatched.js — no prices, no thank-you/review follow-ups) (`order.shippingMethod` — `standard` / `next-day` / `international` / `club` — picks the delivery wording). The dispatch POST `{pi, tracking, service?}` accepts the same `service` keys to override the checkout choice; it's stamped as `shipping_method` so the feed and Evri export agree. POST `{action:'update-order', pi, items?, shipping?}` rewrites a paid order's record for the dashboard's "Edit sizes / address" (club-shop members who picked the wrong size or moved): `items` is the complete new `[{handle,size,qty}]` list, re-encoded over `blankItems()` so no stale `items_N` chunk survives, with `metadata.product` refreshed; `shipping` (name + line1 + postcode + 2-letter country required) is stored as a `ship_*` metadata override via `lib/order-items.js` `shippingOverrideMetadata()` — Stripe rejects `shipping` updates on a succeeded PaymentIntent — and every address reader (feed, confirmation/dispatch emails via `buildOrder`, Evri export) goes through `effectiveShipping(payment)`, which prefers the override; the phone and the address shown in the Stripe dashboard stay as captured at checkout. Succeeded orders only, no emails, amount untouched, stock not re-synced; the response echoes the feed fields (`items`, `lineItems`, `addr`, `address`, `place`, `shippingName`) so the dashboard patches its cached row. The JSON feed carries `capabilities` (`ADMIN_CAPABILITIES`, currently `['update-order', 'analytics', 'kit-dispatch', 'bank-transfer']`): the dashboard enables a feature's button only when the deployed backend lists its action, and any unrecognised POST `action` now returns 400 instead of falling through to the dispatch path. **Bank-transfer orders** (`lib/bank-orders.js`) are merged into `awaiting`/`dispatched` in date order with the Stripe ones (cancelled ones hidden) and the response carries `bank: {store:'ok'\|'unconfigured'\|'error', details}` for the dashboard's setup notice; every action above accepts a `bt_` id (dispatch refuses until `paidAt` is set), plus `{action:'mark-paid', id, paid:true\|false}` (first tick emails `bank-transfer-paid`; un-tick clears silently), `{action:'cancel-order', id}` (unpaid only — voids it, no email) and `{action:'send', kind:'bank-received', id}` (re-sends the payment-details email). `production` also emails the club's PAID bank orders |
| `api/analytics.js` | Read-only analytics feed for the dashboard's Analytics tab (same `?key=` gate + CORS as admin; `vercel.json` maxDuration 60). `scope=orders&since&until` (≤93-day windows the dashboard drives) joins `paymentIntents.search` (succeeded, `latest_charge.balance_transaction` expanded → settled GBP gross/fee/net/fx) with `checkout.sessions.list({status:'complete', expand:['data.line_items']})` so every order carries exact per-line money; sizes come from the PI item tuples matched by Stripe PRODUCT id (price ids get archived by `--prune`); anything that doesn't line up falls back to pro-rata allocation flagged `allocated:true`. `&lite=1` returns only the mutable fields (refunds, dispatch/delivery stamps) for the weekly re-scan. `scope=changes&since` lists refunds + disputes by THEIR OWN created date (settled GBP from each one's balance transaction; `warning_*` disputes are inquiries). `scope=treasury` = `balance.retrieve()` + payouts by arrival date. `scope=funnel&start&end` = GA4 Data API users/events per day (`GA4_PROPERTY_ID` + the Google service account; returns `{error:'GA4_NOT_CONFIGURED', serviceAccount}` with the setup steps until granted). 5-minute per-instance cache, never on errors; the query string is never logged (rows carry emails + postcodes). Advertised to the dashboard as the `analytics` capability. Metric definitions: `ANALYTICS.md` |
| `api/export-evri.js` | Evri bulk-despatch CSV export, read from Stripe (`?key=proton_export_key`) — plus paid, posted bank-transfer orders |
| `api/bank-transfer-order.js` | **Bank-transfer club shops** (2026-11-10). Shops in `config/shipping.js` `BANK_TRANSFER_CLUBS` (flag `bankTransfer: true` in the website's `data/clubs.ts`; `npm run audit:stripe` checks they match) take no card payment: the cart posts `{items, customer:{name,email,phone}, delivery:'post'\|'collection', address, website (honeypot), attribution…}` here instead of to Stripe. Prices resolve exactly as checkout (club override from the product map), delivery is the zone's standard GBP rate (free ≥ £110; `club` / `collection` modes work as for Stripe, decided from the handles), the order is written to the Blob store via `lib/bank-orders.js` and the member gets `emails/bank-transfer-received.js` — Proton Lab's account details (`config/bank.js`; `BANK_*` env vars override) plus the unique payment reference `PL-NNNNN` and a 7-day pay-by date; ops get the usual "New order" note flagged *awaiting payment*. Refuses with 503 (and an ops alert) until the store token and the account details are set; `dryRun:true` prices and validates without storing or emailing (the live smoke test, reports `configured`). Honeypot → 200 and nothing stored; 5 orders / 10 min per IP per instance. Nothing here is paid: the order waits on the dashboard until Elijah ticks it |
| `lib/bank-orders.js` | The store for bank-transfer orders — one private JSON blob per order in the project's Vercel Blob store (`bank-orders/bt_NNNNN.json`, `BLOB_READ_WRITE_TOKEN`; `@vercel/blob` `put`/`get({useCache:false})`/`list`). Ids `bt_NNNNN` (5 digits like Stripe's hashed order numbers so refs read the same), `payRef` `PL-NNNNN`, `paidAt` (the tick), `paidEmailAt`, `productionAt`, `dispatchedAt`, `tracking`, `deliveredAt`, `cancelledAt`, server-priced `lines`, `subtotal`/`shippingAmount`/`amount` in pence. `feedEntry()` renders the admin-feed shape (+ `payment:'bank-transfer'`, `paid`, `paidAt`, `payRef`, `payBy`), `emailOrder()` the email-template shape. `api/admin.js` routes every `pi` that `isBankOrderId()` to this record instead of Stripe, so the dashboard treats both alike |
| `emails/bank-transfer-received.js`, `emails/bank-transfer-paid.js` | The two bank-transfer customer emails: order received + how to pay (reference, amount, account details, pay-by date, then the usual order table) and payment received (sent by `{action:'mark-paid'}`, once) |
| `api/stock-sync.js` | Nightly stock sync (Vercel cron 20:00 UTC) — tallies un-synced paid orders from PI `metadata.items`, commits decremented `inventory/stock.csv` to the website repo via GitHub API, stamps PIs `stock_synced`. **Club-shop payments are skipped** (`isClubOrder`: `channel:'club'`, a `club_handle`, or a `club` other than Proton Lab — made-to-order kit shares handles like socks with the retail range) and stamped `stock_synced:'skipped-club:<date>'` so they are not re-read; the summary email and JSON report `clubSkipped`. `?dryRun=1&key=...` for a report-only run (never stamps) |
| `lib/order-items.js` | The ONE encoder/decoder for an order's line items in PaymentIntent metadata. Stripe caps each metadata value at 500 chars, so lines are stored as compact `[handle, size, qty]` tuples split across `items`, `items_2`, … (names come from the product map at read time); `decodeItems()` also reads the legacy single-value `[{name,handle,size,qty}]` format of pre-Oct-2026 orders. Also owns the delivery-address override (`shippingOverrideMetadata()` / `effectiveShipping()` — ship_* metadata written by admin update-order, preferred by every address reader), the cached `loadProductMap()`, `summariseItems()` (≤500-char human list for `metadata.product`, the admin feed and the Evri Contents column) and `sizesNote()` (≤1,200-char Stripe submit note). Writers: `create-checkout-session.js`. Readers: `webhook.js`, `admin.js`, `export-evri.js`, `stock-sync.js`, `checkout-session.js` |
| `lib/analytics-core.cjs` | The ONE source of the analytics maths — pure functions over the unified order-row shape (Stripe rows from `api/analytics.js` + the dashboard's manual/wholesale rows): revenue by channel net of refunds, AOV + rolling mean, SKU drill-down, sell-through + weeks of cover, new vs returning, geo, attribution, ROAS/CAC, funnel, refunds by SKU, payouts, rolling-12-month VAT turnover (gross incl. shipping − refunds, never `net`), gross margin, KPI tiles, club cards, CSV. Written as one IIFE + `module.exports` guard so `scripts/inline-analytics-core.mjs` can paste it verbatim into `order-dashboard.html` between the ANALYTICS-CORE markers (edit here, re-run the script; default import only in Node). Tested by `npm test` (`test/analytics-core.test.mjs` against `test/fixtures/analytics-rows.json`) |
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
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store token for bank-transfer orders — injected automatically once a **private** Blob store is created and connected to this project (Vercel → Storage → Create → Blob); redeploy after connecting |
| `BANK_ACCOUNT_NAME`, `BANK_SORT_CODE`, `BANK_ACCOUNT_NUMBER`, `BANK_IBAN`, `BANK_BIC` | Optional OVERRIDES of `config/bank.js` — Proton Lab's business account the customer pays INTO, printed in the bank-transfer emails and on /order-received. The config file is the normal source (hard-coded by Elijah's choice, 2026-11-10; Claude never types the numbers — Elijah fills them in); bank-transfer ordering answers 503 until name, sort code and account number are all present |
| `GA4_PROPERTY_ID` | NUMERIC GA4 property id (Admin → Property details; not the `G-…` measurement id) for `api/analytics.js` `scope=funnel`. One-time: enable the Google Analytics Data API in the service account's GCP project and add its `client_email` as Viewer on the property |
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

**Set up a club shop's payment mode:** Stripe (default — nothing to do) or bank transfer (needs the Blob store connected and `config/bank.js` filled in): add the handle to `config/shipping.js` `BANK_TRANSFER_CLUBS` AND flag the club `bankTransfer: true` in the website's `data/clubs.ts` (delivery mode is independent — set `centralDelivery` / `collectionOption` + the matching list as usual, or neither to post at the standard rate). `npm run audit:stripe` (website repo) fails if the two drift. Bank-transfer orders show on the dashboard like Stripe ones with an "Awaiting payment" tag until Elijah ticks **Payment received** (emails the member); unpaid orders can't be dispatched and can be cancelled from the row. Analytics counts a ticked order as an `invoice` row (ANALYTICS.md).

**Add a new product or price (the real checklist — `frontend-snippet.js` is legacy):**
1. Website repo `data/products.ts`: add the product (copy a sibling block; next free `prod_0NN` id, `sizes('0NN', '<price>.00')`, images per the image conventions or the `img()` placeholder). Retail products also need rows in `inventory/stock.csv` (`handle,size,quantity`) and, to appear in the live shop, their handle in `lib/api.ts` `SUMMER_2026_HANDLES`.
2. `PLPricelist.csv`: add the row (`Category,Product,handle,Price (GBP),Collection,Notes`). Club prices go in `data/club-prices.json` under the club handle.
3. `node scripts/stripe-sync.js` — creates the Stripe product/prices and rewrites BOTH `data/stripe-products.json` and `protonlab-backend/data/stripe-products.json` (never edit those by hand).
4. `npm run audit:stripe` — must end "NO ISSUES". It cross-checks pricelist ↔ catalogue ↔ club tiles ↔ price maps ↔ club delivery flags ↔ live Stripe (`node scripts/stripe-audit.mjs --static` for a quick no-network pass).
5. Push. The backend redeploys automatically because its JSON changed; the checkout health cron (`api/health-checkout.js`) probes a 12-line basket four times a day.
Nothing about order size needs touching: line items are encoded by `lib/order-items.js` into as many metadata values as needed, so adding products or lengthening names cannot reintroduce a basket limit.

**Run the tests:** `npm test` — `node --test` over `test/*.test.mjs`; the handler tests swap the real `stripe` package for `test/mock-stripe.mjs` through the loader hook in `test/hooks.mjs` (`register('./hooks.mjs', import.meta.url)` at the top of a test file, then dynamic-import the handler). No network, no keys needed.

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

