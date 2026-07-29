# Inventory

Stock lives in `stock.csv`. Edit it in Numbers, Excel, or any text editor.

## Columns

| Column     | Meaning                                              |
| ---------- | ---------------------------------------------------- |
| `handle`   | Product slug (must match a handle in `data/products.ts`) |
| `size`     | Exact size label (XS, S, M, L, XL, S/M, L/XL, One Size) |
| `quantity` | Non-negative integer — units on hand                 |

One row per variant. Duplicates error. Unknown handles error.

## Workflow

1. Edit `inventory/stock.csv` in Numbers (open, edit, save — keep CSV format).
2. From the repo root run:
   ```bash
   npm run sync-stock
   ```
   This compiles the CSV into `data/stock.json`, which the site imports. It also runs automatically on `npm run dev` and `npm run build`.
3. Commit both files and push:
   ```bash
   git add inventory/stock.csv data/stock.json
   git commit -m "restock"
   git push
   ```
   Vercel redeploys in ~30s and the shop reflects the new counts.

## What the site does with it

- **Shop page** — hides any product whose variants are all at 0 (“only list in stock items”).
- **Product page** — sold-out sizes are struck through and disabled. The button says *Sold Out* when nothing is available, *Only N left* warns below 3, *Max in cart* blocks further adds past the stock count.
- **Cart** — capped at the available quantity per variant.
- **Checkout (Phase 2)** — Stripe backend will re-validate stock server-side and reject the session if any line exceeds what's on hand. Not wired yet; the current flow trusts the client.

## Adding a new product

1. Add it to `data/products.ts` as usual.
2. Add a row per size to `stock.csv` (use `0` if not yet in stock).
3. `npm run sync-stock` will warn if a product has no stock rows.

## Auto-decrement (live)

Stock now updates itself through `protonlab-backend`:

- **Nightly sync** — a Vercel cron (`protonlab-backend/api/stock-sync.js`, 20:00 UTC) tallies the day's paid Stripe orders from each PaymentIntent's `metadata.items`, subtracts them from `stock.csv` in **one commit** via the GitHub API, and stamps the orders `stock_synced` so they are never counted twice. Vercel then redeploys the site with the new counts. A summary email goes to `STOCK_SYNC_EMAIL` if set.
- **Dashboard movements** — the local order dashboard's Stock tab (manual orders, order-form drops, +/− adjustments) posts signed deltas to `api/admin.js` (`action:'stock-move'`), which commits the same way immediately.

All writes go through `protonlab-backend/lib/stock.js`, which enforces a **quantity-only invariant**: rows are never added, removed, renamed, or reordered — so a bad commit can never fail the `sync-stock` build check. Movements against a `handle::size` not in the CSV are skipped and reported (that's what keeps made-to-order club kit out of stock counts).

Still manual:

- **Refunds** — not re-incremented automatically; add the units back via the dashboard's Stock tab.
- **New products** — add rows here by hand as described above; the backend will not create rows.
- The `data/stock.json` committed in the repo may lag the CSV — `prebuild` regenerates it on every deploy, so the **deployed** site is always right.
