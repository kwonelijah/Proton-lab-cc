#!/bin/zsh
# scripts/mac/install.sh — sets up the two Mac helpers (run in Terminal):
#   com.protonlab.backup    21:30 daily — download the dashboard backup to
#                           ~/Desktop/Proton /Backups/Dashboard/dashboard-YYYY-MM-DD.json
#   com.protonlab.invoices  every 5 min — upload new invoices from
#                           ~/Desktop/Proton /Custom Orders/<Client>/Invoices/
# The key never appears on screen or in a file: it is created here, stored in
# the macOS Keychain and copied to the clipboard once for Vercel.
#   zsh scripts/mac/install.sh            install / update
#   zsh scripts/mac/install.sh --uninstall
set -e
HERE=${0:A:h}
APP="$HOME/Library/Application Support/ProtonLab"; BIN="$APP/bin"; AGENTS="$HOME/Library/LaunchAgents"
LABELS=(com.protonlab.backup com.protonlab.invoices)

if [[ "$1" == "--uninstall" ]]; then
  for l in $LABELS; do launchctl bootout "gui/$UID/$l" 2>/dev/null || true; rm -f "$AGENTS/$l.plist"; done
  echo "Removed the background jobs. (The key stays in the Keychain: security delete-generic-password -s proton-dashboard-mac)"
  exit 0
fi

NODE=$(command -v node) || { echo "Node.js isn't installed (brew install node)"; exit 1; }
mkdir -p "$BIN" "$AGENTS" "$HOME/Library/Logs"
cp "$HERE/lib.mjs" "$HERE/proton-backup.mjs" "$HERE/proton-invoice-watch.mjs" "$BIN/"

if ! /usr/bin/security find-generic-password -s proton-dashboard-mac >/dev/null 2>&1; then
  KEY=$(/usr/bin/openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | cut -c1-48)
  /usr/bin/security add-generic-password -a "$USER" -s proton-dashboard-mac -w "$KEY" -U
  print -n "$KEY" | pbcopy; unset KEY
  echo "1) A new Mac key is on your clipboard."
  echo "   Paste it into Vercel → protonlab-backend → Settings → Environment Variables"
  echo "   as DASHBOARD_MAC_KEY (Production), then redeploy. Then clear the clipboard."
else
  echo "1) Using the Mac key already in your Keychain (copy it again with:"
  echo "   security find-generic-password -s proton-dashboard-mac -w | pbcopy )"
fi

write_plist() {   # label, extra plist keys, script
  cat > "$AGENTS/$1.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$BIN/$3</string></array>
  $2
  <key>StandardOutPath</key><string>$HOME/Library/Logs/$1.launchd.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/$1.launchd.log</string>
</dict></plist>
PLIST
  launchctl bootout "gui/$UID/$1" 2>/dev/null || true
  launchctl bootstrap "gui/$UID" "$AGENTS/$1.plist"
}
write_plist com.protonlab.backup '<key>StartCalendarInterval</key><dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>30</integer></dict>' proton-backup.mjs
"$NODE" "$BIN/proton-invoice-watch.mjs" --baseline   # existing invoices are NOT uploaded
write_plist com.protonlab.invoices '<key>StartInterval</key><integer>300</integer><key>RunAtLoad</key><true/>' proton-invoice-watch.mjs

echo "2) Background jobs installed: ${LABELS[*]}"
echo "3) macOS only lets background jobs read the Desktop with Full Disk Access:"
echo "   System Settings → Privacy & Security → Full Disk Access → + → Cmd-Shift-G →"
echo "   $NODE"
echo "   Logs: ~/Library/Logs/proton-backup.log and proton-invoices.log"
