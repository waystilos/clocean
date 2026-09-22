# Deployment Guide

> [!IMPORTANT]
> The one-command deployment provisions the R2 bucket, deploys the Worker, creates the Cloudflare Access application and allow policy, configures production secrets, and redeploys with authentication enabled.

This guide walks you through deploying **Clocean** to your Cloudflare account with zero database setup required.

---


## One-command deployment

After installing Node.js 18+, pnpm, and Pulumi, log in to Cloudflare and Pulumi once:

```bash
npx wrangler login
pulumi login
```

Then run:

```bash
export CLOCEAN_ACCESS_EMAIL="you@example.com"
export CLOUDFLARE_ACCESS_TEAM_DOMAIN="your-team.cloudflareaccess.com"
export CLOUDFLARE_API_TOKEN="<token with Workers, R2, and Access edit permissions>"
export PULUMI_CONFIG_PASSPHRASE="<local encryption passphrase>"
pnpm install
pnpm deploy:one-click
```

`CLOUDFLARE_ACCOUNT_ID` is detected from Wrangler when possible. Set it explicitly when using an API token instead of an interactive Wrangler login. The command stores encrypted Pulumi values for the Access team domain and generated session secret, and sends runtime secrets to Wrangler without writing them into Git. The API token is read by Pulumi and Wrangler from the environment and is never written to the repository.

The only required identity setup is the Cloudflare Access team domain and the email address allowed into the application. No email delivery service is used.

## Command-Line Deployment (Wrangler)

If you prefer deploying directly from your terminal:

### 1. Prerequisites
Ensure you have Node.js 18+ installed and log in to your Cloudflare account:
```bash
npx wrangler login
```

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/waystilos/clocean.git
cd clocean
pnpm install
```

### 3. Provision Cloudflare R2 Bucket
Run the automated bucket setup script:
```bash
./scripts/setup-r2.sh
# Or execute manually:
npx wrangler r2 bucket create clocean-storage
```

### 4. Deploy Application
Run the one-step build & deploy command:
```bash
pnpm deploy
```

Before deploying, configure production authentication. Production uses Cloudflare Access rather than email OTP signup. The checked-in Wrangler configuration defaults to `ENVIRONMENT=production` so a deployment cannot accidentally enable local identity overrides:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put CF_ACCESS_AUD
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
```

Set `ALLOWED_ORIGINS` and `APP_URL` to the exact HTTPS application origin in the Cloudflare dashboard or Wrangler environment configuration. The Worker rejects requests when production Access JWT verification is not fully configured. Email service configuration is optional for outbound notifications and is not required for authentication.


Wrangler will:
* Compile the TypeScript React frontend into `./dist`.
* Bundle the edge Worker and Durable Objects.
* Upload static assets to Cloudflare Pages.
* Deploy your API globally.
* Output your live application URL: `https://clocean.<your-subdomain>.workers.dev`.

The deployed `workers.dev` hostname is a valid Access application hostname. A Pages `pages.dev` hostname is only created when the project is deployed as a Pages project; it is not required for this Worker deployment.

---

## Configure Cloudflare Zero Trust Access (Free for 50 Users)

To protect your Clocean instance so only you and your team can log in:

1. Open the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Access** > **Applications**.
3. Click **Add an Application** > select **Self-Hosted**.
4. Configure Application Details:
   * **Application name**: `Clocean Workspace`
   * **Application domain**: `clocean.yourdomain.com` (or your worker custom domain)
   * **Session Duration**: `24 hours`
5. Click **Next** to define your Access Policy:
   * **Policy name**: `Team Access`
   * **Action**: `Allow`
   * **Configure rules**:
     * **Include** -> **Emails**: Enter team members' emails (e.g. `alex@company.com`, `marcus@company.com`).
     * OR **Include** -> **Email Domains**: Enter your company domain (e.g. `company.com`).
6. Click **Next** > **Save**.

### How Authentication Works:
Once configured, Cloudflare Access intercepts requests before they hit your Worker. Clocean independently verifies the accompanying `Cf-Access-Jwt-Assertion` against Cloudflare's public JWKS and only then uses the email claim. The email header alone is never trusted in production.

Production email verification signup is disabled. Users must open the Access-protected application URL and authenticate through the configured identity provider. Local development retains mock identity and OTP helpers for testing without an email service.

---

## Frequently Asked Questions

### Do I need a paid database like PostgreSQL, Supabase, or MongoDB?
**No.** Clocean was specifically designed to eliminate database costs. All structured data (workspace hierarchy, documents, tasks, photos, user profiles) and binary files are stored directly in Cloudflare R2 as JSON models.

### How much does this cost to run on Cloudflare?
* **Storage & Bandwidth (R2)**: 10 GB free, 10M read operations free, 1M write operations free. **$0 egress fees**.
* **Authentication (Zero Trust)**: **Free for up to 50 users**.
* **Workers & Pages**: Extremely generous free tier (100,000 requests/day).
* **Durable Objects**: Included on the Workers Paid plan ($5/month). When running locally (`pnpm worker:dev`), Durable Objects are simulated locally at **$0 cost**.
