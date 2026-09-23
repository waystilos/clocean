import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

// Pulumi Configuration
const config = new pulumi.Config();
const accountId = config.require("accountId");
const domain = config.get("domain") || "clocean.example.com";
const allowedEmails = config.getObject<string[]>("allowedEmails") || [];
const allowedEmailDomains = config.getObject<string[]>("allowedEmailDomains") || [];
const zoneId = config.get("zoneId"); // Optional: if managing DNS CNAME through Pulumi

// 1. Cloudflare R2 Bucket for Clocean (Database & File Storage)
// When pre-provisioned via `pnpm setup:r2`, Pulumi references it directly without conflicting.
// Set `pulumi config set createR2Bucket true` if you want Pulumi to manage creating it fresh.
const createR2Bucket = config.getBoolean("createR2Bucket") ?? false;
export const storageBucket = createR2Bucket
  ? new cloudflare.R2Bucket("clocean-storage", {
      accountId: accountId,
      name: "clocean-storage",
      location: "WNAM",
    })
  : null;

// 2. Provision Cloudflare Zero Trust Access Application (Free for up to 50 active users)
export const accessApp = new cloudflare.AccessApplication("clocean-app", {
  accountId: accountId,
  name: "Clocean Workspace",
  domain: domain,
  type: "self_hosted",
  appLauncherVisible: true,
  sessionDuration: "24h",
  autoRedirectToIdentity: false,
  corsHeaders: [
    {
      allowedHeaders: ["Content-Type", "Authorization", "x-user-email", "Range", "If-Match"],
      allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedOrigins: [`https://${domain}`],
      allowCredentials: true,
      maxAge: 86400,
    },
  ],
});

// Email-code login works without a separate mail service or OAuth credentials.
// Access still admits only identities covered by the allow policy below.
export const emailCodeProvider = new cloudflare.AccessIdentityProvider("clocean-email-code", {
  accountId,
  name: "Email code",
  type: "onetimepin",
});

// The team-domain root is an App Launcher, not the application itself. Without
// this resource Cloudflare shows an administrator-only setup warning there.
export const appLauncher = new cloudflare.AccessApplication("clocean-app-launcher", {
  accountId,
  name: "Clocean App Launcher",
  type: "app_launcher",
  sessionDuration: "24h",
});

// 3. Provision Cloudflare Zero Trust Access Policy (Team Members)
export const accessPolicy = new cloudflare.AccessPolicy("clocean-team-policy", {
  accountId: accountId,
  applicationId: accessApp.id,
  name: "Team Members Access",
  decision: "allow",
  precedence: 1,
  includes: [
    {
      emails: allowedEmails.length > 0 ? allowedEmails : undefined,
      emailDomains: allowedEmailDomains.length > 0 ? allowedEmailDomains : undefined,
    },
  ],
});

// Do not make the App Launcher more permissive than the protected app.
export const appLauncherPolicy = new cloudflare.AccessPolicy("clocean-launcher-policy", {
  accountId,
  applicationId: appLauncher.id,
  name: "Clocean launcher access",
  decision: "allow",
  precedence: 1,
  includes: [
    {
      emails: allowedEmails.length > 0 ? allowedEmails : undefined,
      emailDomains: allowedEmailDomains.length > 0 ? allowedEmailDomains : undefined,
    },
  ],
});

// 4. Optional DNS Record (If zoneId provided)
if (zoneId) {
  const subdomain = domain.split(".")[0];
  new cloudflare.Record("clocean-dns-record", {
    zoneId: zoneId,
    name: subdomain,
    type: "CNAME",
    content: "clocean.workers.dev",
    proxied: true,
  });
}

// Stack Exports
export const r2BucketName = storageBucket ? storageBucket.name : "clocean-storage";
export const appAudienceTag = accessApp.aud;
export const appDomain = accessApp.domain;
