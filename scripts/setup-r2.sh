#!/usr/bin/env bash
set -e

# ==============================================================================
# Clocean — Automated Cloudflare R2 Provisioning
# ==============================================================================
# Provisions:
#   1. clocean-storage      (Workspace Documents, Files, Tasks, & Activity Log)
#   2. clocean-pulumi-state (Pulumi Infrastructure State Backend)
# ==============================================================================

echo "========================================================"
echo " Clocean Cloudflare R2 Provisioning"
echo "========================================================"

# Step 1: Verify Wrangler installation and authentication
if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required to run Cloudflare Wrangler."
  exit 1
fi

echo "Verifying Cloudflare credentials..."
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID}}"

if [ -z "$ACCOUNT_ID" ]; then
  DETECTED_ID=$(npx wrangler whoami 2>/dev/null | grep -oE '[a-f0-9]{32}' | head -n 1 || true)
  if [ -n "$DETECTED_ID" ]; then
    ACCOUNT_ID="$DETECTED_ID"
    echo "Auto-detected Cloudflare Account ID: $ACCOUNT_ID"
  fi
fi

if [ -z "$ACCOUNT_ID" ]; then
  echo "Warning: Could not automatically detect Cloudflare Account ID."
  echo "Please log in with 'npx wrangler login' or export CLOUDFLARE_ACCOUNT_ID."
fi

# Step 2: Function to safely check and create an R2 bucket
create_r2_bucket() {
  local bucket="$1"
  local description="$2"

  echo ""
  echo "Target: $bucket"
  echo "Purpose: $description"

  # Check existing buckets
  EXISTING_BUCKETS=$(npx wrangler r2 bucket list 2>/dev/null || true)

  if echo "$EXISTING_BUCKETS" | grep -q "\"$bucket\"" || echo "$EXISTING_BUCKETS" | grep -q "$bucket"; then
    echo "Status: [EXISTS] Bucket '$bucket' is already provisioned."
  else
    echo "Status: [CREATING] Provisioning '$bucket'..."
    if npx wrangler r2 bucket create "$bucket"; then
      echo "Status: [CREATED] Successfully created '$bucket'."
    else
      echo "Error: Failed to create bucket '$bucket'."
      echo "Please verify that R2 is enabled on your Cloudflare account:"
      echo "  https://dash.cloudflare.com/?to=/:account/r2"
      exit 1
    fi
  fi
}

# Step 3: Provision both required buckets
create_r2_bucket "clocean-storage" "Primary database and file storage for documents, tasks, and media"
create_r2_bucket "clocean-pulumi-state" "Dedicated state storage backend for Pulumi Infrastructure-as-Code"

# Step 4: Display configuration summary and next steps
echo ""
echo "========================================================"
echo " Cloudflare R2 Setup Complete"
echo "========================================================"
if [ -n "$ACCOUNT_ID" ]; then
  echo "Account ID:   $ACCOUNT_ID"
  echo "R2 Endpoint:  https://${ACCOUNT_ID}.r2.cloudflarestorage.com"
fi
echo "Buckets:"
echo "  - clocean-storage      (Active)"
echo "  - clocean-pulumi-state (Active)"
echo "--------------------------------------------------------"
echo "Next Steps:"
echo ""
echo "1. To deploy the application immediately:"
echo "   pnpm deploy"
echo ""
echo "2. To use Pulumi Infrastructure-as-Code:"
echo "   - Local State:  pnpm login:local"
echo "   - R2 State:     pnpm login:r2"
echo "========================================================"
