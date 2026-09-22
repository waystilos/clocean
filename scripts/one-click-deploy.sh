#!/usr/bin/env bash
set -euo pipefail

# Deploy Clocean, provision its R2/Access infrastructure, and configure the
# production Worker. Cloudflare credentials and the Access team domain must be
# supplied by the operator; secrets are never written to the repository.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' is required." >&2
    exit 1
  fi
}

require_value() {
  if [ -z "${!1:-}" ]; then
    echo "Error: set $1 before running one-click deployment." >&2
    exit 1
  fi
}

require_command npx
require_command pnpm
require_command pulumi
require_command openssl

require_value CLOCEAN_ACCESS_EMAIL
require_value CLOUDFLARE_ACCESS_TEAM_DOMAIN
require_value CLOUDFLARE_API_TOKEN
require_value PULUMI_CONFIG_PASSPHRASE

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:-}}"
if [ -z "$ACCOUNT_ID" ]; then
  ACCOUNT_ID="$(npx wrangler whoami 2>/dev/null | grep -oE '[a-f0-9]{32}' | head -n 1 || true)"
fi
if [ -z "$ACCOUNT_ID" ]; then
  echo "Error: set CLOUDFLARE_ACCOUNT_ID or log in with 'npx wrangler login'." >&2
  exit 1
fi

echo "Preparing R2 buckets..."
bash scripts/setup-r2.sh >/dev/null

echo "Building and deploying the Worker..."
pnpm build
DEPLOY_LOG="$(mktemp)"
trap 'rm -f "$DEPLOY_LOG"' EXIT
npx wrangler deploy 2>&1 | tee "$DEPLOY_LOG"

APP_URL="$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -n 1 || true)"
if [ -z "$APP_URL" ]; then
  echo "Error: could not determine the deployed workers.dev URL." >&2
  exit 1
fi

echo "Provisioning Cloudflare Access for $APP_URL..."
(
  cd infra
  if ! pulumi stack ls --json >/dev/null 2>&1; then
    echo "Error: Pulumi is not logged in. Run 'pulumi login' once, then rerun this command." >&2
    exit 1
  fi
  pulumi stack select prod >/dev/null 2>&1 || pulumi stack init prod
  pulumi config set accountId "$ACCOUNT_ID"
  pulumi config set domain "${APP_URL#https://}"
  pulumi config set allowedEmails "[\"$CLOCEAN_ACCESS_EMAIL\"]"
  pulumi config set allowedEmailDomains '[]'
  pulumi up --yes
)

ACCESS_AUD="$(cd infra && pulumi stack output appAudienceTag)"
if [ -z "$ACCESS_AUD" ]; then
  echo "Error: Pulumi did not return an Access audience tag." >&2
  exit 1
fi

SESSION_SECRET="${CLOCEAN_SESSION_SECRET:-}"
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET="$(cd infra && pulumi config get sessionSecret 2>/dev/null || true)"
fi
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  (cd infra && pulumi config set --secret sessionSecret "$SESSION_SECRET")
fi

put_secret() {
  local name="$1"
  local value="$2"
  printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null
}

echo "Configuring production secrets and origin policy..."
put_secret SESSION_SECRET "$SESSION_SECRET"
put_secret CF_ACCESS_AUD "$ACCESS_AUD"
put_secret CF_ACCESS_TEAM_DOMAIN "$CLOUDFLARE_ACCESS_TEAM_DOMAIN"
put_secret APP_URL "$APP_URL"
put_secret ALLOWED_ORIGINS "$APP_URL"

echo "Redeploying with production authentication enabled..."
npx wrangler deploy

echo ""
echo "Clocean is deployed at: $APP_URL"
echo "Open that URL and authenticate through Cloudflare Access with: $CLOCEAN_ACCESS_EMAIL"
