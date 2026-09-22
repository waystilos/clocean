#!/usr/bin/env bash
set -e

# ==============================================================================
# Pulumi Cloudflare R2 State Backend Login
# ==============================================================================
# Saves Pulumi state in a Cloudflare R2 bucket using R2's S3-compatible API.
# Zero external database or backend costs.
# ==============================================================================

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID}}"
BUCKET_NAME="${PULUMI_R2_BUCKET:-clocean-pulumi-state}"
R2_KEY_ID="${AWS_ACCESS_KEY_ID:-${R2_ACCESS_KEY_ID}}"
R2_SECRET="${AWS_SECRET_ACCESS_KEY:-${R2_SECRET_ACCESS_KEY}}"
REGION="${AWS_REGION:-auto}"

if [ -z "$ACCOUNT_ID" ]; then
  DETECTED_ID=$(npx wrangler whoami 2>/dev/null | grep -oE '[a-f0-9]{32}' | head -n 1 || true)
  if [ -n "$DETECTED_ID" ]; then
    ACCOUNT_ID="$DETECTED_ID"
    echo "Auto-detected Cloudflare Account ID: $ACCOUNT_ID"
  fi
fi

if [ -z "$ACCOUNT_ID" ]; then
  echo "Error: CLOUDFLARE_ACCOUNT_ID is required."
  echo "Find your Account ID in Cloudflare Dashboard overview or log in with 'npx wrangler login'."
  echo "Example: export CLOUDFLARE_ACCOUNT_ID=\"your-account-id\""
  exit 1
fi

if [ -z "$R2_KEY_ID" ] || [ -z "$R2_SECRET" ]; then
  echo "Error: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (or R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) are required."
  echo "Create an R2 API token in Cloudflare Dashboard > R2 > Manage R2 API Tokens with Object Read & Write permissions."
  echo "Example:"
  echo "  export AWS_ACCESS_KEY_ID=\"your-r2-access-key-id\""
  echo "  export AWS_SECRET_ACCESS_KEY=\"your-r2-secret-access-key\""
  exit 1
fi

# Ensure AWS environment variables are set for Pulumi's S3 backend client
export AWS_ACCESS_KEY_ID="$R2_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET"
export AWS_REGION="$REGION"

ENDPOINT="${ACCOUNT_ID}.r2.cloudflarestorage.com"
LOGIN_URL="s3://${BUCKET_NAME}?endpoint=${ENDPOINT}&region=${REGION}"

# Optional: Attempt to auto-create the state bucket via wrangler if logged in
if command -v npx >/dev/null 2>&1; then
  echo "Checking R2 state bucket: $BUCKET_NAME..."
  if npx wrangler r2 bucket list 2>/dev/null | grep -q "$BUCKET_NAME"; then
    echo "Bucket '$BUCKET_NAME' verified."
  else
    echo "Attempting to create R2 bucket '$BUCKET_NAME' via Wrangler..."
    npx wrangler r2 bucket create "$BUCKET_NAME" 2>/dev/null || echo "Note: Ensure '$BUCKET_NAME' exists in Cloudflare Dashboard > R2."
  fi
fi

echo "Connecting Pulumi to Cloudflare R2 state backend..."
echo "Bucket: $BUCKET_NAME"
echo "Endpoint: https://${ENDPOINT}"

pulumi login "$LOGIN_URL"

echo ""
echo "Successfully logged in to Pulumi state backend on Cloudflare R2!"
echo "Bucket: $BUCKET_NAME"
echo "You can now run 'cd infra && pulumi stack init <stack-name>' or 'pulumi up'."
