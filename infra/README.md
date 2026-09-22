# Clocean Infrastructure via Pulumi (TypeScript)

This directory provides a **100% TypeScript** Infrastructure as Code (IaC) program using [`@pulumi/cloudflare`](https://www.pulumi.com/registry/packages/cloudflare/) to automate your Cloudflare Zero Trust Access and R2 storage infrastructure.

---

## 🏛️ What this Pulumi program provisions:

1. **Cloudflare R2 Bucket**:
   * Creates `clocean-storage` in Western North America (`WNAM`) with zero egress fees.
2. **Cloudflare Zero Trust Access Application**:
   * Registers a self-hosted Access Application on your custom domain (e.g. `clocean.yourcompany.com`).
   * Configures CORS headers and 24-hour session durations.
3. **Team Access Policy (Free for 50 Users)**:
   * Restricts workspace access to your specified team email addresses or corporate email domain (e.g. `@yourcompany.com`).
4. **CI/CD Service Token**:
   * Creates an automated `AccessServiceToken` with Client ID / Client Secret for headless API tests or automated worker sync.
5. **Optional DNS CNAME**:
   * Points your custom subdomain to the Cloudflare Worker when `zoneId` is provided.

---

## 🚀 Quickstart

### 1. Install Dependencies
```bash
cd infra
pnpm install
```


### 2. Configure Cloudflare Credentials
Ensure your Cloudflare API token is exported in your environment:
```bash
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
```

### 3. Initialize Pulumi Stack & Set Config
```bash
# Create or select a stack (e.g., prod or dev)
pulumi stack init prod

# Set your Cloudflare Account ID (Required)
pulumi config set accountId "your-cloudflare-account-id"

# Set your desired domain (Optional, defaults to clocean.example.com)
pulumi config set domain "clocean.yourcompany.com"

# Allow entire team domain (e.g. yourcompany.com)
pulumi config set --path allowedEmailDomains '["yourcompany.com"]'

# Or specify individual emails
pulumi config set --path allowedEmails '["alex@yourcompany.com", "marcus@yourcompany.com"]'

# Optional: Set Zone ID if you want Pulumi to manage the DNS record
# pulumi config set zoneId "your-zone-id"
```

### 4. Deploy
```bash
pulumi up
```

### 5. Stack Outputs
Upon successful deployment, Pulumi outputs:
* `r2BucketName`: The provisioned R2 bucket name (`clocean-storage`).
* `appAudienceTag`: The Application Audience tag (AUD) used to cryptographically verify Access JWTs.
* `appDomain`: Your live Zero Trust protected URL.
* `ciClientId` & `ciClientSecret`: Automated service token credentials.

---

## 🔄 Deploying the Application Code
After provisioning your infrastructure with Pulumi, deploy the application code and static assets using Wrangler:
```bash
cd ..
npm run deploy
```
