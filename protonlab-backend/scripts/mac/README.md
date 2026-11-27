# Mac helpers (2026-11-27)

Two small background jobs on Elijah's Mac, installed by `zsh scripts/mac/install.sh`:

| Job | When | What |
|---|---|---|
| `com.protonlab.backup` | 21:30 daily | Downloads the newest nightly dashboard backup to `~/Desktop/Proton /Backups/Dashboard/dashboard-YYYY-MM-DD.json` and keeps 30. An off-site copy: every other backup lives in the same Vercel Blob store as the live data. Contains customer names and addresses, so it never goes by email. |
| `com.protonlab.invoices` | every 5 min | Uploads new `Invoice_NNNNN_*.pdf` files from `Custom Orders/<Client>/Invoices/` to the dashboard (`/api/admin?action=invoice-upload`). The matching deal gets the PDF plus the invoice number, amount and sent date, marked unpaid; with no clear match the invoice appears on Today under "Invoices to link". Reads the builder's sidecar `<name>.json`, or the PDF text (`pdftotext`). Invoices already on disk at install time are marked as sent and never uploaded. |

Both authenticate with `DASHBOARD_MAC_KEY`: created by the installer, kept in the macOS Keychain (`proton-dashboard-mac`), copied to the clipboard once for Vercel. On the server that key can only list/download backups and upload invoices (`api/admin.js`, after the gate).

The installer copies the scripts to `~/Library/Application Support/ProtonLab/bin/`, so the jobs keep working if this checkout moves. Re-run it after changing them. The jobs run on a private copy of Node (`~/Library/Application Support/ProtonLab/bin/proton-node`); macOS Full Disk Access is granted to that copy only (the jobs read the Desktop), so the everyday nvm `node` stays restricted.

By hand: `node scripts/mac/proton-backup.mjs` · `node scripts/mac/proton-invoice-watch.mjs --dry-run` · logs in `~/Library/Logs/`. Remove: `zsh scripts/mac/install.sh --uninstall`.

Status: installed on Elijah's Mac and `DASHBOARD_MAC_KEY` set in Vercel (Production, sensitive) on 27/11/2026.
