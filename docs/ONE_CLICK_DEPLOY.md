# Deployment Guide

> [!IMPORTANT]
> **Work in Progress (WIP)**: The 1-click deployment button is temporarily disabled during testing. Use the command-line deployment steps below.

This guide walks you through deploying **Clocean** to your Cloudflare account with zero database setup required.

---


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


Wrangler will:
* Compile the TypeScript React frontend into `./dist`.
* Bundle the edge Worker and Durable Objects.
* Upload static assets to Cloudflare Pages.
* Deploy your API globally.
* Output your live application URL: `https://clocean.<your-subdomain>.workers.dev`.

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
Once configured, Cloudflare Access intercepts all requests before they hit your worker. When team members visit your site, Cloudflare displays a secure login screen (Google, GitHub, Microsoft, or Email PIN). Upon authentication, Cloudflare passes the verified identity directly to Clocean via the `Cf-Access-Authenticated-User-Email` header.

---

## Frequently Asked Questions

### Do I need a paid database like PostgreSQL, Supabase, or MongoDB?
**No.** Clocean was specifically designed to eliminate database costs. All structured data (workspace hierarchy, documents, tasks, photos, user profiles) and binary files are stored directly in Cloudflare R2 as JSON models.

### How much does this cost to run on Cloudflare?
* **Storage & Bandwidth (R2)**: 10 GB free, 10M read operations free, 1M write operations free. **$0 egress fees**.
* **Authentication (Zero Trust)**: **Free for up to 50 users**.
* **Workers & Pages**: Extremely generous free tier (100,000 requests/day).
* **Durable Objects**: Included on the Workers Paid plan ($5/month). When running locally (`pnpm worker:dev`), Durable Objects are simulated locally at **$0 cost**.
