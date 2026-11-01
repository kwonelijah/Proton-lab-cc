# Analytics — metric definitions

The order dashboard's **Analytics** tab (`~/Desktop/Proton Dashboard/order-dashboard.html`, also opened alone via "↗ New window" = `#view=analytics&solo=1`). Data comes from `api/analytics.js`; every number is computed by `lib/analytics-core.cjs`, which is tested (`npm test`) and inlined into the dashboard by `scripts/inline-analytics-core.mjs`. **Edit the core in this repo, then re-run the script** — never edit the inlined copy.

## Data sources

| Source | What | Where it lives |
|---|---|---|
| Stripe PaymentIntents (succeeded) + Checkout Sessions | every paid web-shop order: settled GBP gross / fee / net / FX from the charge's **balance transaction**; per-line money from the session's line items (already discount-allocated by Stripe), sizes from the PI item tuples matched by Stripe **product** id; email, phone, delivery country/postcode (the corrected address when one was edited), attribution metadata | `scope=orders`, cached in the browser (IndexedDB `proton_analytics_db`, localStorage fallback), synced in 30-day windows from 2026-01-01, then incrementally; a weekly `lite=1` re-scan refreshes refund/dispatch/delivery state |
| Stripe refunds + disputes | by **their own** created date, settled GBP from each one's balance transaction; `warning_*` disputes are inquiries and never count | `scope=changes` |
| Stripe balance + payouts | available / pending balance; payouts by **arrival date** | `scope=treasury` |
| GA4 Data API | users and events per day for page_view / view_item / add_to_cart / begin_checkout | `scope=funnel` (needs `GA4_PROPERTY_ID` + the service account granted Viewer; otherwise the card shows the setup steps) |
| Manual bank-transfer orders | the dashboard's own manual orders (Retail → Orders / club pages); amount as paid, lines priced at list or club price and scaled to the amount | dashboard `manualOrders` |
| Wholesale invoices | hand-entered under Inputs (date, ref, customer, total, lines); line money allocated pro-rata by list price | dashboard `proton_analytics_v1` |
| Unit costs | landed cost per retail product (Stock tab → Unit cost); club kit cost per unit = the club's latest **delivered** pipeline order's production cost ÷ units | dashboard `proton_retail_costs_v1` + pipeline orders |
| Meta spend, stock received, targets, AOV baseline | hand-entered under Inputs (spend also via the Ads Manager CSV export: Day + Amount spent) | dashboard `proton_analytics_v1` |

A row's **channel** is `retail` (Summer 2026 range on protonlab.cc), `club` (club-shop pre-order), `wholesale` (invoice) or `unattributed` (a payment with no shop metadata). Stripe rows follow `metadata.channel`, else a club handle / a club name other than Proton Lab → club, else retail (the same rule as the webhook). The **channel filter** scopes every tile and chart except the GA4 funnel steps (site-wide) and the VAT turnover (whole business).

**Money:** every `*Gbp` figure is pounds as settled by Stripe (EUR orders converted at the balance transaction's exchange rate). `gross` = what the customer paid incl. shipping; `fee` = Stripe's fee; `net` = gross − fee. Legacy orders without a session, or whose line items can't be matched to their size tuples, get lines allocated pro-rata from `(subtotal − discount)` and are flagged `allocated`. Orders placed before 2026-11-01 carry no attribution metadata and are **Unattributed**; after it, a missing `utm_source` means **Direct**; an `fbclid` cookie without UTMs is shown as **Meta click (proxy)**.

Period = the day the charge was captured (`paidAt`), UTC. Grain auto: ≤31 days daily, ≤190 weekly (weeks commence Monday), else monthly.

## Headline tiles

| Tile | Definition |
|---|---|
| Revenue month to date | Σ gross of orders paid this month − refunds issued this month (channel filter applies). Delta vs the same day-of-month last month; sub-line shows last month's full total |
| Orders month to date | paid orders this month |
| Average order value | Σ gross ÷ orders in the selected range; delta vs the AOV baseline (Inputs, default £135 = July 2026) |
| Gross margin | over costed orders in range: (goods revenue − cost of goods) ÷ goods revenue, where goods revenue = gross − shipping charged − refunded (state) and cost of goods = units × unit cost (retail/wholesale) or × club cost per unit; orders with any un-costed line are counted and excluded |
| Refund rate | refunds issued in range ÷ gross paid in range; sub-line counts orders with any refund |
| Repeat customers | customers (lower-cased email, else phone) with ≥2 paid orders ÷ customers, all time, any channel |
| Stripe balance | available balance (GBP) at the last sync; pending in the sub-line |
| Rolling 12-month turnover | Σ gross **incl. shipping, every channel incl. wholesale** over the trailing 365 days − refunds in that window = gross taxable turnover for the £90,000 VAT threshold (never Stripe net). Meter: amber ≥ £75k, red ≥ £85k. Projected crossing = today + headroom ÷ trailing-90-day daily run-rate (roll-off ignored) |
| Blended ROAS | attributed revenue ÷ Meta spend in range; attributed = `utm_source` in facebook / instagram / ig / fb / meta. CAC = spend ÷ new customers among attributed orders |

## Charts (each has a table twin and a CSV of the same rows)

| Card | Definition |
|---|---|
| A1 Revenue over time by channel | stacked columns of gross per period, **net of refunds in the period they were refunded**, by channel |
| A2 Orders vs revenue | two aligned panels on one time axis (no dual y-axis): paid orders, and revenue net of refunds |
| A3 AOV trend | AOV per period + 30-day rolling mean (trailing 30 days to each period's end) + the baseline line |
| A6 Cumulative revenue vs target | running total of net revenue over the range vs the target from Inputs |
| B9 Revenue & units by product | per-line money (Stripe's discount-allocated line amounts, or allocated for legacy lines); drill product → colourway → size (Summer Jersey = Sunset / Red Sky / Ocean Blue; Summer Bib Shorts = Black / Granite / White) |
| B10 Sell-through | per retail product (club kit excluded): units sold all time (retail + wholesale) ÷ units received (Inputs → Stock received; if no batch is recorded received is **implied** as sold + on hand); weeks of cover = on hand ÷ (units sold in the trailing 28 days ÷ 4): red < 4, amber < 8 |
| C15 New vs returning | per period: customers whose first paid order (any channel, all time) is in the period vs returning; wholesale has no customer key |
| C19 Geography | orders and gross by delivery country; UK orders by postcode area (letters of the outward code) |
| D21 Attribution | gross per period by `utm_source`; Direct / Unattributed / Meta click (proxy) as above; past three sources the rest fold into "Other" |
| D22 Meta spend vs attributed revenue | two aligned panels: spend per period and attributed revenue; ROAS and CAC in the footer |
| E26 Checkout funnel | GA4 **users** per step over the range (page_view → view_item → add_to_cart → begin_checkout); the purchase step is Stripe's paid-order count (Stripe + manual, wholesale excluded) because GA4 over-counts purchases. GA4 data lands 24–48 h late and is site-wide |
| F30 Refunds & disputes | refunds by issue date and lost disputes by creation date; per-product / per-size views allocate each amount across the order's lines pro-rata by line money; reason text as Stripe recorded it |
| F33 Payouts & balance | payouts by arrival date, paid vs pending/in transit (failed/cancelled dropped); balance at last sync |
| F35 Rolling turnover | the VAT turnover above at each of the last 11 month-ends and today, with the £75k and £90k lines |
| G37 Club shops | one card per club: orders in its current ordering window (from the Club Shops tab's windows; all orders when none), units by product and size, value ex shipping, days to deadline, cumulative-orders curve with the deadline marked |

## Known limits

- Server-side caching is per warm Vercel instance only (no database); the browser cache is the real one. Sync is manual (↻ Sync); a weekly lite re-scan catches late refunds and dispatch stamps.
- Refund rate and A1 use refund **issue** dates; per-order `refundedGbp` is current state (refreshed by the lite re-scan).
- Attribution exists only for orders placed after the attribution capture went live (2026-11-01).
- GA4 numbers are users, not sessions; the funnel's first four steps ignore the channel filter.
- Monochrome palette: series are told apart by lightness, a legend and direct labels (the dataviz validator's hue checks fail by brand design; colour-blind separation passes).
