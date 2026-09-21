import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

// Pulumi Configuration
const config = new pulumi.Config();
const accountId = config.require("accountId");
const domain = config.get("domain") || "clocean.example.com";
const allowedEmails = config.getObject<string[]>("allowedEmails") || [];
const allowedEmailDomains = config.getObject<string[]>("allowedEmailDomains") || ["clocean.co"];
const zoneId = config.get("zoneId"); // Optional: if managing DNS CNAME through Pulumi

// 1. Provision Cloudflare R2 Bucket for Clocean (Database & File Storage)
export const storageBucket = new cloudflare.R2Bucket("clocean-storage", {
  accountId: accountId,
  name: "clocean-storage",
  location: "WNAM", // Western North America or APAC/EEUR
});

// 2. Provision Cloudflare Zero Trust Access Application (Free for up to 50 active users)
export const accessApp = new cloudflare.AccessApplication("clocean-app", {
  accountId: accountId,
  name: "Clocean Workspace",
  domain: domain,
  type: "self_hosted",
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

// 4. Provision Cloudflare Access Service Token (For CI/CD or Automated Testing)
export const serviceToken = new cloudflare.AccessServiceToken("clocean-ci-token", {
  accountId: accountId,
  name: "Clocean CI Automation Token",
  duration: "8760h", // 1 year
});

// Service Token Access Policy
export const serviceTokenPolicy = new cloudflare.AccessPolicy("clocean-ci-policy", {
  accountId: accountId,
  applicationId: accessApp.id,
  name: "CI Service Token Policy",
  decision: "non_identity",
  precedence: 2,
  includes: [
    {
      serviceTokens: [serviceToken.id],
    },
  ],
});

// 5. Optional DNS Record (If zoneId provided)
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
export const r2BucketName = storageBucket.name;
export const appAudienceTag = accessApp.aud;
export const appDomain = accessApp.domain;
export const ciClientId = serviceToken.clientId;
export const ciClientSecret = serviceToken.clientSecret;
