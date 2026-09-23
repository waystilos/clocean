# Deployment Guide

> [!IMPORTANT]
> The one-command deployment provisions the R2 bucket, deploys the Worker, creates the Cloudflare Access application, App Launcher, approved-email policies, and email-code sign-in, configures production secrets, and redeploys with authentication enabled.

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
cp .env.example .env
# Edit .env and replace the placeholder values.
pnpm install
pnpm deploy:one-click
```

`CLOUDFLARE_ACCOUNT_ID` is detected from Wrangler when possible. Set it explicitly when using an API token instead of an interactive Wrangler login. The command stores encrypted Pulumi values for the Access team domain and generated session secret, and sends runtime secrets to Wrangler without writing them into Git. The API token is read by Pulumi and Wrangler from the environment and is never written to the repository.

The API token must include **Access: Apps and Policies Write** and **Access: Organizations, Identity Providers, and Groups Write** for the App Launcher and email-code provider, in addition to the Worker/R2 permissions needed by Wrangler. If the identity-provider resource fails with Cloudflare error `1010`, add the latter permission to the token in Cloudflare, update `CLOUDFLARE_API_TOKEN` locally, and rerun the command (or `pulumi up` in `infra/`). Until that succeeds, approved users can only use an already configured provider such as Cloudflare-account login.

The only required identity setup is the Cloudflare Access team domain and the email address allowed into the application. Cloudflare sends Access one-time codes; no separate email delivery service is needed.

Share and bookmark only the deployed **application URL** (for example, `https://clocean.example.workers.dev`). It opens the “Log in to Clocean Workspace” page with the configured identity-provider choices. Do **not** send users to the Access **team-domain root** (`https://example.cloudflareaccess.com/`): that address is Cloudflare's generic App Launcher and shows an extra Welcome/Login screen even when enabled. The team domain is needed for OAuth callbacks and JWT verification, but it is not Clocean's public entry point. If the team-domain root says “contact your administrator to enable the Access App Launcher,” apply the current Pulumi stack with `pnpm deploy:one-click`; the Worker alone cannot configure that Cloudflare page. Confirm the app's live redirect and login methods with `node --env-file=.env scripts/check-access-experience.mjs <app-hostname>`.

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

## Configure Cloudflare Zero Trust Access (Free for up to 50 Users)

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

For manual deployments, also create an **App Launcher** application and an Allow policy with the *same approved emails or domains*, make the Clocean application visible in the launcher, and add the **One-time PIN** identity provider under **Integrations > Identity providers**. A team-domain URL is not a substitute for the protected application URL. Keep the allow policy narrow: an authenticated identity is not automatically entitled to every workspace, but the production default workspace has special first-user bootstrap behavior.

### Google and GitHub OAuth sign-in

Cloudflare Access presents the provider choices before Clocean loads. Clocean verifies the resulting Access JWT; it does not store Google or GitHub credentials or implement its own social-login buttons. Both OAuth integrations require their own client ID and secret, and the Cloudflare API token needs **Access: Organizations, Identity Providers, and Groups Write** to manage them through infrastructure code. Create OAuth credentials in the provider dashboards; never commit the secrets.

1. Keep **Cloudflare** as an admin fallback under **Zero Trust > Integrations > Identity providers**. New Zero Trust organizations normally include it, initially restricted to Cloudflare account members. Keep the Access Allow policy limited to approved emails or domains; adding a sign-in provider does not grant everyone workspace access.
2. For [Google](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/), create a dedicated Google Cloud project if needed. Configure the Google Auth Platform consent screen with an **External** audience for non-Workspace users, then create a **Web application** OAuth client. Set the authorized JavaScript origin to `https://<your-team-name>.cloudflareaccess.com` and the authorized redirect URI to `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback`. Google Workspace is not required. If the consent screen remains in testing, only its configured test users can sign in; publish it when ready for the intended audience.
3. For [GitHub](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/github/), open **Settings > Developer settings > OAuth Apps > New OAuth app** in the account that should own the integration. Set its homepage URL to `https://<your-team-name>.cloudflareaccess.com` and its authorization callback URL to the same `/cdn-cgi/access/callback` URL. Register the app, then generate and securely retain its client secret. A GitHub organization is not required.
4. In **Zero Trust > Integrations > Identity providers**, add **Google** and **GitHub** separately using each provider's client ID and secret. Complete GitHub's **Finish setup** authorization. Test both connections there. Then edit **Access controls > Applications > Clocean Workspace** to allow both providers, keeping instant authentication off so users can choose. Open the *application URL*, not the team-domain root, and test each option with an email allowed by the Access policy.

The two OAuth clients are not created by a Worker deployment. Google and GitHub login are available on Cloudflare Access's free tier for up to 50 users, but any Google Cloud project billing must be reviewed separately before enabling paid APIs. Once the email-code provider is successfully provisioned, approved users can also use it without a Google or GitHub account. There is no direct Apple sign-in button: [Sign in with Apple for a website](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple) requires Apple developer configuration and [membership](https://developer.apple.com/programs/). A user who created a Cloudflare account using Apple may still sign in through the **Cloudflare** option, subject to the Access policy.

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
