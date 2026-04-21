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

## Auto-decrement (Phase 2, not live)

When wired, the Stripe webhook will subtract purchased units from `stock.csv` by committing back to the repo via the GitHub API. Until that ships, decrement manually after each order.
