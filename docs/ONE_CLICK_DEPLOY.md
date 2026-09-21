# One-Click Deployment Guide

This guide walks you through deploying **Clocean** to your Cloudflare account in under 5 minutes with zero database setup required.

---

## 🚀 Option 1: Deploy with Workers Button (Fastest)

Click the official Cloudflare Workers deployment button below:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ardonbailey/clocean)

### What this automated flow does:
1. Prompts you to authorize Cloudflare with your GitHub account.
2. Creates a private fork of the Clocean repository in your GitHub account.
3. Provisions the required Cloudflare R2 bucket (`clocean-storage`).
4. Compiles the React 19 frontend and builds the Cloudflare Worker.
5. Deploys the application live on a `*.workers.dev` subdomain.

---

## 🛠️ Option 2: Command-Line Deployment (Wrangler)

If you prefer deploying directly from your terminal:

### 1. Prerequisites
Ensure you have Node.js 18+ installed and log in to your Cloudflare account:
```bash
npx wrangler login
```

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/ardonbailey/clocean.git
cd clocean
npm install
```

### 3. Provision Cloudflare R2 Bucket
Run the automated bucket setup script:
```bash
npm run setup
# Or execute manually:
npx wrangler r2 bucket create clocean-storage
```

### 4. Deploy Application
Run the one-step build & deploy command:
```bash
npm run deploy
```

Wrangler will:
* Compile the TypeScript React frontend into `./dist`.
* Bundle the edge Worker and Durable Objects.
* Upload static assets to Cloudflare Pages.
* Deploy your API globally.
* Output your live application URL: `https://clocean.<your-subdomain>.workers.dev`.

---

## 🔒 Step 3: Configure Cloudflare Zero Trust Access (Free for 50 Users)

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

## ❓ Frequently Asked Questions

### Do I need a paid database like PostgreSQL, Supabase, or MongoDB?
**No.** Clocean was specifically designed to eliminate database costs. All structured data (workspace hierarchy, documents, tasks, photos, user profiles) and binary files are stored directly in Cloudflare R2 as JSON models.

### How much does this cost to run on Cloudflare?
* **Storage & Bandwidth (R2)**: 10 GB free, 10M read operations free, 1M write operations free. **$0 egress fees**.
* **Authentication (Zero Trust)**: **Free for up to 50 users**.
* **Workers & Pages**: Extremely generous free tier (100,000 requests/day).
* **Durable Objects**: Included on the Workers Paid plan ($5/month). When running locally (`npm run worker:dev`), Durable Objects are simulated locally at **$0 cost**.
