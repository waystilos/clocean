# Clocean Infrastructure via Pulumi (TypeScript)

This directory provides a **100% TypeScript** Infrastructure as Code (IaC) program using [`@pulumi/cloudflare`](https://www.pulumi.com/registry/packages/cloudflare/) to automate your Cloudflare Zero Trust Access and R2 storage infrastructure.

---

## What this Pulumi program provisions:

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

## Quickstart

### 1. Install Dependencies
```bash
cd infra
pnpm install
```


### 2. Choose Your Pulumi State Backend

Pulumi requires a state backend to store infrastructure state. You can save state in Cloudflare R2 (zero external fees) or locally on your machine.

#### Option A: Local Backend (Zero Setup, No Cloud Account Required)
Stores state directly on your local machine in `~/.pulumi/`:
```bash
pnpm login:local
# Or directly:
pulumi login --local
```

#### Option B: Cloudflare R2 Backend (Recommended for Teams, $0 Costs)
Stores state in Cloudflare R2 using R2's S3-compatible API:
1. Provision the R2 buckets (creates `clocean-storage` and `clocean-pulumi-state`):
```bash
pnpm setup:r2
```
2. Create an R2 API Token in **Cloudflare Dashboard > R2 > Manage R2 API Tokens** with **Object Read & Write** permissions.
3. Export your credentials in your terminal:
```bash
export CLOUDFLARE_ACCOUNT_ID="your-cloudflare-account-id"
export AWS_ACCESS_KEY_ID="your-r2-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-r2-secret-access-key"
export PULUMI_CONFIG_PASSPHRASE="your-encryption-passphrase"
```
4. Run the automated login script:
```bash
pnpm login:r2
# Or directly via Pulumi:
pulumi login "s3://clocean-pulumi-state?endpoint=${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com&region=auto"
```

> **Why is `clocean-pulumi-state` empty initially?**
> The R2 state bucket only receives state files once a stack is initialized and `pulumi up` runs. If `pulumi login` is executed without the `s3://` target URL, Pulumi defaults to Pulumi Cloud or `~/.pulumi` local disk. Always make sure the `s3://...` endpoint URL is specified or use `pnpm login:r2`.

---

### 3. Configure Cloudflare API Credentials
Ensure your Cloudflare API token is exported in your environment:
```bash
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
```

### 4. Initialize Pulumi Stack & Set Config
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

### 5. Deploy Infrastructure
```bash
pulumi up
```

### 6. Stack Outputs
Upon successful deployment, Pulumi outputs:
* `r2BucketName`: The provisioned R2 bucket name (`clocean-storage`).
* `appAudienceTag`: The Application Audience tag (AUD) used to cryptographically verify Access JWTs.
* `appDomain`: Your live Zero Trust protected URL.
* `ciClientId` & `ciClientSecret`: Automated service token credentials.

---

## Deploying the Application Code
After provisioning your infrastructure with Pulumi, deploy the application code and static assets using Wrangler:
```bash
cd ..
pnpm deploy
```
