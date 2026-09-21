#!/usr/bin/env bash
set -e

BUCKET_NAME="clocean-storage"

echo "Checking Cloudflare R2 bucket: $BUCKET_NAME..."

if npx wrangler r2 bucket list | grep -q "$BUCKET_NAME"; then
  echo "Bucket '$BUCKET_NAME' already exists."
else
  echo "Creating Cloudflare R2 bucket '$BUCKET_NAME'..."
  npx wrangler r2 bucket create "$BUCKET_NAME"
  echo "Bucket '$BUCKET_NAME' successfully created!"
fi

echo "Setup complete! Run 'npm run deploy' to deploy Clocean."
