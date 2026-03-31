#!/bin/bash
# setup.sh — ProtonLab Backend — Phase 1: Stripe only
# Run once from inside the project folder:
#   chmod +x setup.sh && ./setup.sh

set -e

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   ProtonLab Backend — Phase 1 Setup        ║"
echo "║   Stripe payments only (no Google Sheets)  ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# ─── Check dependencies ────────────────────────────────────────────────────

echo "→ Checking dependencies..."

if ! command -v node &> /dev/null; then
  echo "✗ Node.js not found. Install from https://nodejs.org then re-run."
  exit 1
fi

if ! command -v git &> /dev/null; then
  echo "✗ Git not found. Install from https://git-scm.com then re-run."
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "✗ GitHub CLI not found. Install from https://cli.github.com then re-run."
  exit 1
fi

echo "✓ Node $(node -v), git $(git --version | awk '{print $3}'), gh ready"

# ─── Install packages ──────────────────────────────────────────────────────

echo ""
echo "→ Installing npm packages..."
npm install
echo "✓ Done"

# ─── Install Vercel CLI ────────────────────────────────────────────────────

echo ""
echo "→ Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
  npm install -g vercel
fi
echo "✓ Vercel CLI ready"

# ─── Collect Stripe credentials ────────────────────────────────────────────

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║         Stripe credentials needed          ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "  1. Go to dashboard.stripe.com"
echo "  2. Make sure you are in TEST MODE (toggle top-left)"
echo "  3. Go to Developers → API keys"
echo "     Copy your Secret key (sk_test_...)"
echo ""

read -p "Stripe Secret Key (sk_test_...): " STRIPE_SECRET_KEY

echo ""
echo "  We'll add the webhook secret after deployment."
echo "  Leave it blank for now — press Enter to continue."
echo ""
read -p "Stripe Webhook Secret (or press Enter to skip): " STRIPE_WEBHOOK_SECRET
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-"placeholder_add_after_deploy"}

read -p "Your site URL (e.g. https://protonlab.cc): " SITE_URL
read -p "GitHub repo name (e.g. protonlab-backend): " REPO_NAME

# ─── Write .env ────────────────────────────────────────────────────────────

cat > .env <<EOF
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
SITE_URL=$SITE_URL

# Phase 2 — add these later
# GOOGLE_SHEET_ID=
# GOOGLE_SERVICE_ACCOUNT_JSON=
# ANTHROPIC_API_KEY=
EOF

echo ""
echo "✓ .env created"

# ─── Git init ─────────────────────────────────────────────────────────────

echo ""
echo "→ Setting up git..."
if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

# ─── GitHub repo ───────────────────────────────────────────────────────────

echo ""
echo "→ Creating GitHub repo: $REPO_NAME"
gh auth status &> /dev/null || gh auth login
gh repo create "$REPO_NAME" --private --source=. --remote=origin 2>/dev/null || echo "  (Repo may already exist — continuing)"
echo "✓ GitHub repo ready"

# ─── First Vercel deploy ───────────────────────────────────────────────────

echo ""
echo "→ Running first Vercel deploy..."
echo "  (Sign in to Vercel if prompted — link to your existing account)"
echo ""
vercel --yes
echo "✓ Deployed"

# ─── Get deployment URL ────────────────────────────────────────────────────

DEPLOY_URL=$(vercel inspect --prod 2>/dev/null | grep -E 'https://' | head -1 | awk '{print $NF}' || echo "")
if [ -z "$DEPLOY_URL" ]; then
  read -p "Paste your Vercel deployment URL (from above output): " DEPLOY_URL
fi

# ─── Add env vars to Vercel ───────────────────────────────────────────────

echo ""
echo "→ Adding environment variables to Vercel..."
echo "$STRIPE_SECRET_KEY" | vercel env add STRIPE_SECRET_KEY production --force > /dev/null 2>&1 || true
echo "$STRIPE_WEBHOOK_SECRET" | vercel env add STRIPE_WEBHOOK_SECRET production --force > /dev/null 2>&1 || true
echo "$SITE_URL" | vercel env add SITE_URL production --force > /dev/null 2>&1 || true
echo "✓ Environment variables added"

# ─── Add GitHub secrets ────────────────────────────────────────────────────

echo ""
echo "→ Adding GitHub Actions secrets..."
if [ -f ".vercel/project.json" ]; then
  VERCEL_ORG_ID=$(node -e "console.log(require('./.vercel/project.json').orgId)")
  VERCEL_PROJECT_ID=$(node -e "console.log(require('./.vercel/project.json').projectId)")

  echo ""
  echo "  Go to vercel.com/account/tokens and create a token."
  read -p "Vercel API token: " VERCEL_TOKEN

  gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN"
  gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID"
  gh secret set VERCEL_PROJECT_ID --body "$VERCEL_PROJECT_ID"
  echo "✓ GitHub secrets added"
else
  echo "  ⚠ .vercel/project.json not found — skipping GitHub secrets."
  echo "  Add VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID manually in GitHub → Settings → Secrets."
fi

# ─── Push to GitHub ────────────────────────────────────────────────────────

echo ""
echo "→ Pushing to GitHub..."
git add -A
git commit -m "Phase 1: Stripe-only backend setup" 2>/dev/null || echo "  (Nothing new to commit)"
git push -u origin main
echo "✓ Pushed — future pushes auto-deploy via GitHub Actions"

# ─── Final instructions ────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            Phase 1 setup complete ✓                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Your backend URL: $DEPLOY_URL"
echo ""
echo "  ── Two manual steps remaining ───────────────────────────────"
echo ""
echo "  1. Add the Stripe webhook:"
echo "     → dashboard.stripe.com → Developers → Webhooks → Add endpoint"
echo "     → URL: $DEPLOY_URL/api/webhook"
echo "     → Event: payment_intent.succeeded"
echo "     → Copy the Signing Secret (whsec_...)"
echo "     → Then run:"
echo "       vercel env add STRIPE_WEBHOOK_SECRET production"
echo "       vercel --prod"
echo ""
echo "  2. Test a payment:"
echo "     → Open test-checkout.html in your browser"
echo "     → Update BACKEND_URL to: $DEPLOY_URL"
echo "     → Use test card: 4242 4242 4242 4242 / 12/34 / 123"
echo "     → Check Vercel logs to confirm the order was received"
echo ""
echo "  Once payments are confirmed working, run phase 2 to connect Google Sheets."
echo ""
