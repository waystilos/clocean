# Clocean Infrastructure with Pulumi

This folder provides Infrastructure as Code (IaC) using **Pulumi (TypeScript)** to automate your Cloudflare Zero Trust Access and R2 Bucket provisioning.

---

## What this provisions:
1. **Cloudflare R2 Bucket**: `clocean-storage` (zero egress, S3-compatible).
2. **Cloudflare Zero Trust Access Application**: Protects your application's domain.
3. **Cloudflare Access Policy**: Manages team access (free for up to 50 active users) by email list or corporate email domain (e.g. `@yourcompany.com`).

---

## Usage

1. Install Pulumi dependencies:
   ```bash
   cd infra
   npm install
   ```

2. Configure your Cloudflare Account ID and Domain:
   ```bash
   pulumi config set accountId <your-cloudflare-account-id>
   pulumi config set domain clocean.yourdomain.com
   pulumi config set --path allowedEmailDomains '["yourcompany.com"]'
   ```

3. Deploy:
   ```bash
   pulumi up
   ```

4. Once provisioned, deploy the Worker and Pages frontend with:
   ```bash
   npm run deploy
   ```
